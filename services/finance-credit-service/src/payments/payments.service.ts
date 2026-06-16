import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment, PaymentType, PaymentStatus } from './entities/payment.entity';
import { Invoice, InvoiceStatus } from './entities/invoice.entity';
import { FinancialPointLedger, LedgerEntryType } from './entities/financial-point-ledger.entity';
import { FinancialArchiveItem, ArchiveItemType } from '../financial-archives/entities/financial-archive-item.entity';
import { FinancialProfilesService } from '../financial-profiles/financial-profiles.service';
import { EventsService } from '../events/events.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepo: Repository<Payment>,
    @InjectRepository(Invoice)
    private readonly invoiceRepo: Repository<Invoice>,
    @InjectRepository(FinancialPointLedger)
    private readonly ledgerRepo: Repository<FinancialPointLedger>,
    @InjectRepository(FinancialArchiveItem)
    private readonly archiveRepo: Repository<FinancialArchiveItem>,
    private readonly financialProfilesService: FinancialProfilesService,
    private readonly eventsService: EventsService,
  ) {}

  /**
   * Initiate a payment for inscription, subscription or one-time payment.
   * FIN-AC-001: a confirmed inscription payment:
   *   - Creates or upgrades the FinancialProfile to "membre"
   *   - Creates an Invoice
   *   - Creates a FinancialArchiveItem
   *   - Credits financial points (1 point per euro for inscription)
   *   - Publishes PaymentConfirmed + InvoiceIssued events
   * FIN-AC-002: only one active inscription per owner allowed.
   */
  async initiatePayment(
    ownerId: string,
    dto: CreatePaymentDto,
    correlationId?: string,
  ): Promise<{ payment: Payment; invoice: Invoice }> {
    // Guard: prevent duplicate active inscription
    if (dto.paymentType === PaymentType.INSCRIPTION) {
      await this.assertNoActiveInscription(ownerId);
    }

    // Create the payment record (immediately confirmed for Phase 1 — real provider integration deferred)
    const payment = await this.paymentRepo.save(
      this.paymentRepo.create({
        ownerId,
        paymentType: dto.paymentType,
        amountCents: dto.amountCents,
        paymentStatus: PaymentStatus.CONFIRMED,
        externalReference: dto.externalReference ?? null,
        correlationId: dto.correlationId ?? correlationId ?? null,
      }),
    );

    // Generate invoice number (sequential — in production: use a dedicated sequence)
    const invoiceNumber = this.generateInvoiceNumber(payment.id);

    const invoice = await this.invoiceRepo.save(
      this.invoiceRepo.create({
        paymentId: payment.id,
        invoiceNumber,
        ownerId,
        amountCents: payment.amountCents,
        invoiceStatus: InvoiceStatus.ISSUED,
        correlationId: payment.correlationId,
      }),
    );

    // For inscription: upgrade profile to "membre" and credit points
    if (dto.paymentType === PaymentType.INSCRIPTION) {
      const updatedProfile = await this.financialProfilesService.createOrUpgradeToMembre(
        ownerId,
        payment.correlationId,
      );

      // Credit financial points: 1 point per euro
      const pointsEarned = Math.floor(dto.amountCents / 100);
      const newBalance = (updatedProfile.pointsBalance ?? 0) + pointsEarned;

      await this.ledgerRepo.save(
        this.ledgerRepo.create({
          ownerId,
          entryType: LedgerEntryType.CREDIT,
          pointsAmount: pointsEarned,
          balanceAfter: newBalance,
          description: `Inscription payment ${payment.id} — ${pointsEarned} points credited`,
          referenceId: payment.id,
          correlationId: payment.correlationId,
        }),
      );

      await this.financialProfilesService.updatePointsBalance(ownerId, newBalance);
    }

    // Archive this event
    const archiveItem = await this.archiveRepo.save(
      this.archiveRepo.create({
        ownerId,
        itemType: ArchiveItemType.PAYMENT,
        referenceId: payment.id,
        label: `${dto.paymentType} — €${(dto.amountCents / 100).toFixed(2)} — Facture ${invoiceNumber}`,
        amountCents: dto.amountCents,
        balanceSnapshot: null,
        correlationId: payment.correlationId,
      }),
    );

    // Publish domain events
    this.eventsService.publish(
      'PaymentConfirmed',
      {
        paymentId: payment.id,
        ownerId,
        paymentType: payment.paymentType,
        amountCents: payment.amountCents,
        invoiceId: invoice.id,
        archiveItemId: archiveItem.id,
      },
      payment.correlationId,
    );

    this.eventsService.publish(
      'InvoiceIssued',
      {
        invoiceId: invoice.id,
        invoiceNumber,
        paymentId: payment.id,
        ownerId,
        amountCents: invoice.amountCents,
      },
      payment.correlationId,
    );

    return { payment, invoice };
  }

  /**
   * Check whether the owner has a confirmed inscription payment.
   * Used by the internal route for legal-document-service and orchestration-service.
   */
  async checkInscriptionPaid(ownerId: string): Promise<{ isPaid: boolean; paymentId: string | null }> {
    const inscriptionPayment = await this.paymentRepo.findOne({
      where: {
        ownerId,
        paymentType: PaymentType.INSCRIPTION,
        paymentStatus: PaymentStatus.CONFIRMED,
      },
    });

    return {
      isPaid: !!inscriptionPayment,
      paymentId: inscriptionPayment?.id ?? null,
    };
  }

  // ---- Private helpers ----

  private async assertNoActiveInscription(ownerId: string): Promise<void> {
    const existingInscription = await this.paymentRepo.findOne({
      where: {
        ownerId,
        paymentType: PaymentType.INSCRIPTION,
        paymentStatus: PaymentStatus.CONFIRMED,
      },
    });

    if (existingInscription) {
      throw new ConflictException(
        `Owner ${ownerId} already has a confirmed inscription payment (FIN-AC-002)`,
      );
    }
  }

  private generateInvoiceNumber(paymentId: string): string {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const shortId = paymentId.slice(0, 8).toUpperCase();
    return `VM-${datePart}-${shortId}`;
  }
}
