import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ParentLinkRequest, ParentLinkRequestStatus } from './entities/parent-link-request.entity';
import { CreateParentLinkRequestDto } from './dto/create-parent-link-request.dto';
import { StudentPedagogicalProfile } from '../profiles/entities/student-pedagogical-profile.entity';
import { FinanceOwnerStudentLink } from '../relations/entities/finance-owner-student-link.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { Actor } from '../profiles/profiles.service';

@Injectable()
export class ParentLinkRequestsService {
  private readonly logger = new Logger(ParentLinkRequestsService.name);

  constructor(
    @InjectRepository(ParentLinkRequest)
    private readonly requestRepo: Repository<ParentLinkRequest>,
    @InjectRepository(StudentPedagogicalProfile)
    private readonly studentPedaRepo: Repository<StudentPedagogicalProfile>,
    @InjectRepository(FinanceOwnerStudentLink)
    private readonly financeLinkRepo: Repository<FinanceOwnerStudentLink>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Submit a new parent-link request.
   * Allowed for PARENT_FINANCEUR only.
   * Validates that the studentId corresponds to an existing student pedagogical profile.
   * Returns 400 if the student profile is not found.
   * Returns 409 if a pending request already exists for this parent–student pair.
   */
  async createRequest(dto: CreateParentLinkRequestDto, actor: Actor): Promise<ParentLinkRequest> {
    if (actor.role !== UserRole.PARENT_FINANCEUR) {
      throw new ForbiddenException('Only a parent_financeur may submit a parent-link request');
    }

    const studentProfile = await this.studentPedaRepo.findOne({ where: { userId: dto.studentId } });
    if (!studentProfile) {
      throw new BadRequestException(
        `No student profile found for studentId ${dto.studentId}. Verify the student ID.`,
      );
    }

    const pendingRequest = await this.requestRepo.findOne({
      where: {
        parentId: actor.id,
        studentId: dto.studentId,
        status: ParentLinkRequestStatus.PENDING,
      },
    });
    if (pendingRequest) {
      throw new ConflictException(
        'A pending parent-link request already exists for this parent–student pair',
      );
    }

    const newRequest = this.requestRepo.create({
      parentId: actor.id,
      studentId: dto.studentId,
      status: ParentLinkRequestStatus.PENDING,
    });
    const savedRequest = await this.requestRepo.save(newRequest);

    // Best-effort notification to the student
    await this.notifyUser(
      dto.studentId,
      'Un parent demande à être rattaché à votre compte. Vérifiez vos demandes de rattachement.',
    );

    return savedRequest;
  }

  /**
   * List parent-link requests filtered by role:
   * - PARENT_FINANCEUR: only their own requests
   * - ELEVE: only requests targeting them
   * - RP or TI: all requests
   */
  async listRequests(actor: Actor): Promise<ParentLinkRequest[]> {
    if (actor.role === UserRole.PARENT_FINANCEUR) {
      return this.requestRepo.find({
        where: { parentId: actor.id },
        order: { requestedAt: 'DESC' },
      });
    }

    if (actor.role === UserRole.ELEVE) {
      return this.requestRepo.find({
        where: { studentId: actor.id },
        order: { requestedAt: 'DESC' },
      });
    }

    const privilegedRoles = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];
    if (privilegedRoles.includes(actor.role)) {
      return this.requestRepo.find({ order: { requestedAt: 'DESC' } });
    }

    throw new ForbiddenException(
      'Only parent_financeur, eleve, responsable_pedagogique, or technicien_informatique may list parent-link requests',
    );
  }

  /**
   * Approve a parent-link request.
   * Allowed for the targeted élève, RP, or TI.
   * On approval, creates the finance-owner–student link using existing logic.
   */
  async approveRequest(requestId: string, actor: Actor): Promise<ParentLinkRequest> {
    const linkRequest = await this.findRequestOrFail(requestId);

    this.assertCanProcessRequest(linkRequest, actor);

    if (linkRequest.status !== ParentLinkRequestStatus.PENDING) {
      throw new ConflictException('Only a pending request can be approved');
    }

    // Create the actual finance-owner–student link if it does not already exist
    const existingLink = await this.financeLinkRepo.findOne({
      where: { financeOwnerId: linkRequest.parentId, studentId: linkRequest.studentId },
    });
    if (!existingLink) {
      const newLink = this.financeLinkRepo.create({
        financeOwnerId: linkRequest.parentId,
        studentId: linkRequest.studentId,
      });
      await this.financeLinkRepo.save(newLink);
    }

    linkRequest.status = ParentLinkRequestStatus.APPROVED;
    linkRequest.processedAt = new Date();
    linkRequest.processedBy = actor.id;
    const savedRequest = await this.requestRepo.save(linkRequest);

    // Best-effort notification to the parent
    await this.notifyUser(
      linkRequest.parentId,
      'Votre demande de rattachement à un élève a été approuvée.',
    );

    return savedRequest;
  }

  /**
   * Reject a parent-link request.
   * Allowed for the targeted élève, RP, or TI.
   */
  async rejectRequest(requestId: string, actor: Actor): Promise<ParentLinkRequest> {
    const linkRequest = await this.findRequestOrFail(requestId);

    this.assertCanProcessRequest(linkRequest, actor);

    if (linkRequest.status !== ParentLinkRequestStatus.PENDING) {
      throw new ConflictException('Only a pending request can be rejected');
    }

    linkRequest.status = ParentLinkRequestStatus.REJECTED;
    linkRequest.processedAt = new Date();
    linkRequest.processedBy = actor.id;
    const savedRequest = await this.requestRepo.save(linkRequest);

    // Best-effort notification to the parent
    await this.notifyUser(
      linkRequest.parentId,
      'Votre demande de rattachement à un élève a été rejetée.',
    );

    return savedRequest;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async findRequestOrFail(requestId: string): Promise<ParentLinkRequest> {
    const linkRequest = await this.requestRepo.findOne({ where: { id: requestId } });
    if (!linkRequest) {
      throw new NotFoundException(`Parent-link request ${requestId} not found`);
    }
    return linkRequest;
  }

  /**
   * Verifies that the actor has rights to approve or reject the given request.
   * Only the targeted élève (matching studentId), RP, or TI may process requests.
   */
  private assertCanProcessRequest(linkRequest: ParentLinkRequest, actor: Actor): void {
    const privilegedRoles = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ];

    if (privilegedRoles.includes(actor.role)) return;

    if (actor.role === UserRole.ELEVE && actor.id === linkRequest.studentId) return;

    throw new ForbiddenException(
      'Only the targeted élève, a responsable_pedagogique, or a technicien_informatique may process this request',
    );
  }

  /**
   * Best-effort HTTP notification to dashboard-notification-service using native fetch.
   * Logs and continues on failure — never throws.
   */
  private async notifyUser(userId: string, message: string): Promise<void> {
    const dashboardServiceUrl = this.configService.get<string>('DASHBOARD_NOTIFICATION_SERVICE_URL');
    if (!dashboardServiceUrl) {
      this.logger.warn('DASHBOARD_NOTIFICATION_SERVICE_URL not set — skipping notification');
      return;
    }

    try {
      await fetch(`${dashboardServiceUrl}/internal/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message }),
      });
    } catch (notificationError) {
      this.logger.warn(
        `Failed to notify user ${userId} via dashboard-notification-service: ${(notificationError as Error).message}`,
      );
    }
  }
}
