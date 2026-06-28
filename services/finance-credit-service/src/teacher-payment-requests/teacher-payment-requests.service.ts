import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  TeacherPaymentRequest,
  TeacherPaymentRequestStatus,
} from './entities/teacher-payment-request.entity';
import { FinancialPointLedger, LedgerEntryType } from '../payments/entities/financial-point-ledger.entity';
import { FinancialArchiveItem, ArchiveItemType } from '../financial-archives/entities/financial-archive-item.entity';
import { FinancialProfilesService } from '../financial-profiles/financial-profiles.service';
import { EventsService } from '../events/events.service';
import { UserRole } from '../common/enums/user-role.enum';
import { CreateTeacherPaymentRequestDto } from './dto/create-teacher-payment-request.dto';
import {
  ValidateTeacherPaymentRequestDto,
  ValidationDecision,
} from './dto/validate-teacher-payment-request.dto';

@Injectable()
export class TeacherPaymentRequestsService {
  constructor(
    @InjectRepository(TeacherPaymentRequest)
    private readonly requestRepo: Repository<TeacherPaymentRequest>,
    @InjectRepository(FinancialPointLedger)
    private readonly ledgerRepo: Repository<FinancialPointLedger>,
    @InjectRepository(FinancialArchiveItem)
    private readonly archiveRepo: Repository<FinancialArchiveItem>,
    private readonly financialProfilesService: FinancialProfilesService,
    private readonly eventsService: EventsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Submit a teacher payment request with attached invoice reference.
   * FIN-FB-002: only the teacher themselves can create their payment request.
   * Supports idempotency key to prevent duplicate submissions.
   */
  async createRequest(
    teacherId: string,
    dto: CreateTeacherPaymentRequestDto,
    correlationId?: string,
  ): Promise<TeacherPaymentRequest> {
    // Idempotency check
    if (dto.idempotencyKey) {
      const existingRequest = await this.requestRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existingRequest) {
        return existingRequest;
      }
    }

    const savedRequest = await this.requestRepo.save(
      this.requestRepo.create({
        teacherId,
        fundingOwnerId: dto.fundingOwnerId,
        studentId: dto.studentId ?? null,
        amountCents: dto.amountCents,
        description: dto.description,
        invoiceReference: dto.invoiceReference ?? null,
        requestStatus: TeacherPaymentRequestStatus.PENDING,
        idempotencyKey: dto.idempotencyKey ?? null,
        correlationId: dto.correlationId ?? correlationId ?? null,
      }),
    );

    this.eventsService.publish(
      'TeacherPaymentRequested',
      {
        requestId: savedRequest.id,
        teacherId,
        fundingOwnerId: dto.fundingOwnerId,
        studentId: dto.studentId ?? null,
        amountCents: dto.amountCents,
        description: dto.description,
      },
      savedRequest.correlationId ?? undefined,
    );

    return savedRequest;
  }

  /**
   * Validate or reject a teacher payment request.
   * FIN-AC-003: only AF can validate or reject.
   * On validation: debits financial points from the funding owner and creates an archive entry.
   *
   * Atomicity: all database writes (ledger, archive, request status update) are wrapped
   * in a single transaction. The events.publish() call happens after the transaction commits
   * so that events are only emitted on success.
   */
  async validateRequest(
    requestId: string,
    dto: ValidateTeacherPaymentRequestDto,
    reviewerId: string,
    reviewerRole: string,
    correlationId?: string,
  ): Promise<TeacherPaymentRequest> {
    if (reviewerRole !== UserRole.ADMINISTRATEUR_FINANCIER) {
      throw new ForbiddenException('Only AF (AdministrateurFinancier) can validate payment requests');
    }

    const paymentRequest = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!paymentRequest) {
      throw new NotFoundException(`Teacher payment request ${requestId} not found`);
    }

    if (paymentRequest.requestStatus !== TeacherPaymentRequestStatus.PENDING) {
      throw new ConflictException(
        `Request ${requestId} is already ${paymentRequest.requestStatus}`,
      );
    }

    if (
      dto.decision === ValidationDecision.REJECTED &&
      (!dto.rejectionReason || dto.rejectionReason.trim().length === 0)
    ) {
      throw new BadRequestException('A rejection reason is required when rejecting a request');
    }

    const effectiveCorrelationId =
      dto.correlationId ?? correlationId ?? paymentRequest.correlationId ?? null;

    // All writes are wrapped in a single transaction to ensure atomicity
    const updatedRequest = await this.dataSource.transaction(async (manager) => {
      const requestRepository = manager.getRepository(TeacherPaymentRequest);
      const ledgerRepository = manager.getRepository(FinancialPointLedger);
      const archiveRepository = manager.getRepository(FinancialArchiveItem);

      if (dto.decision === ValidationDecision.VALIDATED) {
        // Debit financial points from the funding owner (1 point per euro)
        const pointsToDebit = Math.floor(paymentRequest.amountCents / 100);
        const fundingProfile = await this.financialProfilesService.findByOwnerId(
          paymentRequest.fundingOwnerId,
          reviewerId,
          reviewerRole,
        );

        const newBalance = (fundingProfile.pointsBalance ?? 0) - pointsToDebit;

        await ledgerRepository.save(
          ledgerRepository.create({
            ownerId: paymentRequest.fundingOwnerId,
            entryType: LedgerEntryType.DEBIT,
            pointsAmount: pointsToDebit,
            balanceAfter: newBalance,
            description: `Teacher payment validated — request ${requestId} — ${pointsToDebit} points debited`,
            referenceId: requestId,
            correlationId: effectiveCorrelationId,
          }),
        );

        await this.financialProfilesService.updatePointsBalance(
          paymentRequest.fundingOwnerId,
          newBalance,
        );

        // Create an archive entry for the funding owner
        await archiveRepository.save(
          archiveRepository.create({
            ownerId: paymentRequest.fundingOwnerId,
            itemType: ArchiveItemType.LEDGER_ENTRY,
            referenceId: requestId,
            label: `Paiement formateur validé — ${paymentRequest.description} — −${pointsToDebit} pts`,
            amountCents: -paymentRequest.amountCents,
            balanceSnapshot: newBalance,
            correlationId: effectiveCorrelationId,
          }),
        );
      }

      return requestRepository.save({
        ...paymentRequest,
        requestStatus:
          dto.decision === ValidationDecision.VALIDATED
            ? TeacherPaymentRequestStatus.VALIDATED
            : TeacherPaymentRequestStatus.REJECTED,
        rejectionReason: dto.rejectionReason ?? null,
        reviewedBy: reviewerId,
        correlationId: effectiveCorrelationId,
      });
    });

    // Publish domain event after the transaction commits (not part of the transactional scope)
    const eventType =
      dto.decision === ValidationDecision.VALIDATED
        ? 'TeacherPaymentValidated'
        : 'PaymentIncidentDetected';

    this.eventsService.publish(
      eventType,
      {
        requestId,
        teacherId: paymentRequest.teacherId,
        fundingOwnerId: paymentRequest.fundingOwnerId,
        amountCents: paymentRequest.amountCents,
        decision: dto.decision,
        rejectionReason: dto.rejectionReason ?? null,
        reviewedBy: reviewerId,
      },
      effectiveCorrelationId ?? undefined,
    );

    return updatedRequest;
  }

  /**
   * List payment requests for a given teacher.
   * Readable by the teacher themselves, AF, or RP.
   */
  async findByTeacher(
    teacherId: string,
    requesterId: string,
    requesterRole: string,
  ): Promise<TeacherPaymentRequest[]> {
    this.assertCanRead(teacherId, requesterId, requesterRole);

    return this.requestRepo.find({
      where: { teacherId },
      order: { createdAt: 'DESC' },
    });
  }

  // ---- Private helpers ----

  private assertCanRead(
    teacherId: string,
    requesterId: string,
    requesterRole: string,
  ): void {
    const privilegedReadRoles: string[] = [
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (requesterId === teacherId) return;
    if (privilegedReadRoles.includes(requesterRole)) return;
    throw new ForbiddenException('Access to teacher payment requests is not allowed');
  }
}
