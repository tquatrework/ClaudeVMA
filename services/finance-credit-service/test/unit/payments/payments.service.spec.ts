import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { PaymentsService } from '../../../src/payments/payments.service';
import { Payment, PaymentType, PaymentStatus } from '../../../src/payments/entities/payment.entity';
import { Invoice, InvoiceStatus } from '../../../src/payments/entities/invoice.entity';
import { FinancialPointLedger, LedgerEntryType } from '../../../src/payments/entities/financial-point-ledger.entity';
import { FinancialArchiveItem, ArchiveItemType } from '../../../src/financial-archives/entities/financial-archive-item.entity';
import { FinancialProfilesService } from '../../../src/financial-profiles/financial-profiles.service';
import { EventsService } from '../../../src/events/events.service';
import { FinancialProfileType } from '../../../src/financial-profiles/entities/financial-profile.entity';

const mockPaymentRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockInvoiceRepo = {
  save: jest.fn(),
  create: jest.fn(),
};

const mockLedgerRepo = {
  save: jest.fn(),
  create: jest.fn(),
};

const mockArchiveRepo = {
  save: jest.fn(),
  create: jest.fn(),
};

const mockFinancialProfilesService = {
  createOrUpgradeToMembre: jest.fn(),
  updatePointsBalance: jest.fn(),
};

const mockEventsService = { publish: jest.fn() };

const buildPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'payment-1',
  ownerId: 'owner-1',
  paymentType: PaymentType.INSCRIPTION,
  amountCents: 9900,
  paymentStatus: PaymentStatus.CONFIRMED,
  externalReference: null,
  correlationId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

const buildProfile = () => ({
  id: 'profile-1',
  ownerId: 'owner-1',
  profileType: FinancialProfileType.MEMBRE,
  pointsBalance: 0,
  fundingEndDate: null,
  paymentMethod: null,
  paymentReference: null,
  correlationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('PaymentsService', () => {
  let service: PaymentsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Invoice), useValue: mockInvoiceRepo },
        { provide: getRepositoryToken(FinancialPointLedger), useValue: mockLedgerRepo },
        { provide: getRepositoryToken(FinancialArchiveItem), useValue: mockArchiveRepo },
        { provide: FinancialProfilesService, useValue: mockFinancialProfilesService },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();
  });

  // ---- initiatePayment ----

  describe('initiatePayment', () => {
    it('creates a confirmed inscription payment, invoice, ledger entry and archive item', async () => {
      const payment = buildPayment();
      const invoice = {
        id: 'invoice-1',
        paymentId: payment.id,
        invoiceNumber: 'VM-20260116-PAYMENT1',
        ownerId: 'owner-1',
        amountCents: 9900,
        invoiceStatus: InvoiceStatus.ISSUED,
        correlationId: null,
        issuedAt: new Date(),
      };
      const archiveItem = {
        id: 'archive-1',
        ownerId: 'owner-1',
        itemType: ArchiveItemType.PAYMENT,
        referenceId: payment.id,
        label: 'inscription — €99.00',
        amountCents: 9900,
        balanceSnapshot: null,
        correlationId: null,
        occurredAt: new Date(),
      };

      mockPaymentRepo.findOne.mockResolvedValue(null); // no existing inscription
      mockPaymentRepo.create.mockReturnValue(payment);
      mockPaymentRepo.save.mockResolvedValue(payment);
      mockInvoiceRepo.create.mockReturnValue(invoice);
      mockInvoiceRepo.save.mockResolvedValue(invoice);
      mockFinancialProfilesService.createOrUpgradeToMembre.mockResolvedValue(buildProfile());
      mockLedgerRepo.create.mockReturnValue({});
      mockLedgerRepo.save.mockResolvedValue({});
      mockFinancialProfilesService.updatePointsBalance.mockResolvedValue(undefined);
      mockArchiveRepo.create.mockReturnValue(archiveItem);
      mockArchiveRepo.save.mockResolvedValue(archiveItem);

      const result = await service.initiatePayment('owner-1', {
        paymentType: PaymentType.INSCRIPTION,
        amountCents: 9900,
      });

      expect(result.payment.id).toBe('payment-1');
      expect(result.invoice.id).toBe('invoice-1');
      expect(mockFinancialProfilesService.createOrUpgradeToMembre).toHaveBeenCalledWith('owner-1', null);
      expect(mockLedgerRepo.save).toHaveBeenCalledTimes(1);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'PaymentConfirmed',
        expect.objectContaining({ paymentId: 'payment-1', ownerId: 'owner-1' }),
        null,
      );
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'InvoiceIssued',
        expect.objectContaining({ invoiceId: 'invoice-1' }),
        null,
      );
    });

    it('credits correct number of points for inscription (1 point per euro)', async () => {
      const payment = buildPayment({ amountCents: 19900 }); // €199 = 199 points
      const profile = buildProfile();
      const invoice = { id: 'invoice-2', issuedAt: new Date() };
      const archiveItem = { id: 'archive-2', occurredAt: new Date() };

      mockPaymentRepo.findOne.mockResolvedValue(null);
      mockPaymentRepo.create.mockReturnValue(payment);
      mockPaymentRepo.save.mockResolvedValue(payment);
      mockInvoiceRepo.create.mockReturnValue(invoice);
      mockInvoiceRepo.save.mockResolvedValue(invoice);
      mockFinancialProfilesService.createOrUpgradeToMembre.mockResolvedValue(profile);
      mockLedgerRepo.create.mockReturnValue({});
      mockLedgerRepo.save.mockResolvedValue({});
      mockFinancialProfilesService.updatePointsBalance.mockResolvedValue(undefined);
      mockArchiveRepo.create.mockReturnValue(archiveItem);
      mockArchiveRepo.save.mockResolvedValue(archiveItem);

      await service.initiatePayment('owner-1', {
        paymentType: PaymentType.INSCRIPTION,
        amountCents: 19900,
      });

      expect(mockLedgerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: LedgerEntryType.CREDIT,
          pointsAmount: 199,
          balanceAfter: 199, // profile starts at 0
        }),
      );
      expect(mockFinancialProfilesService.updatePointsBalance).toHaveBeenCalledWith('owner-1', 199);
    });

    it('does NOT create ledger entry for versement_ponctuel', async () => {
      const payment = buildPayment({ paymentType: PaymentType.VERSEMENT_PONCTUEL });
      const invoice = { id: 'invoice-3', issuedAt: new Date() };
      const archiveItem = { id: 'archive-3', occurredAt: new Date() };

      mockPaymentRepo.create.mockReturnValue(payment);
      mockPaymentRepo.save.mockResolvedValue(payment);
      mockInvoiceRepo.create.mockReturnValue(invoice);
      mockInvoiceRepo.save.mockResolvedValue(invoice);
      mockArchiveRepo.create.mockReturnValue(archiveItem);
      mockArchiveRepo.save.mockResolvedValue(archiveItem);

      await service.initiatePayment('owner-1', {
        paymentType: PaymentType.VERSEMENT_PONCTUEL,
        amountCents: 5000,
      });

      expect(mockLedgerRepo.save).not.toHaveBeenCalled();
      expect(mockFinancialProfilesService.createOrUpgradeToMembre).not.toHaveBeenCalled();
    });

    it('throws ConflictException when owner already has a confirmed inscription (FIN-AC-002)', async () => {
      const existingInscription = buildPayment();
      mockPaymentRepo.findOne.mockResolvedValue(existingInscription);

      await expect(
        service.initiatePayment('owner-1', {
          paymentType: PaymentType.INSCRIPTION,
          amountCents: 9900,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates correlationId to payment and events', async () => {
      const payment = buildPayment({ correlationId: 'corr-abc' });
      const invoice = { id: 'invoice-4', issuedAt: new Date() };
      const archiveItem = { id: 'archive-4', occurredAt: new Date() };

      mockPaymentRepo.findOne.mockResolvedValue(null);
      mockPaymentRepo.create.mockReturnValue(payment);
      mockPaymentRepo.save.mockResolvedValue(payment);
      mockInvoiceRepo.create.mockReturnValue(invoice);
      mockInvoiceRepo.save.mockResolvedValue(invoice);
      mockFinancialProfilesService.createOrUpgradeToMembre.mockResolvedValue(buildProfile());
      mockLedgerRepo.create.mockReturnValue({});
      mockLedgerRepo.save.mockResolvedValue({});
      mockFinancialProfilesService.updatePointsBalance.mockResolvedValue(undefined);
      mockArchiveRepo.create.mockReturnValue(archiveItem);
      mockArchiveRepo.save.mockResolvedValue(archiveItem);

      await service.initiatePayment('owner-1', {
        paymentType: PaymentType.INSCRIPTION,
        amountCents: 9900,
        correlationId: 'corr-abc',
      });

      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'PaymentConfirmed',
        expect.any(Object),
        'corr-abc',
      );
    });
  });

  // ---- checkInscriptionPaid ----

  describe('checkInscriptionPaid', () => {
    it('returns isPaid=true when owner has a confirmed inscription', async () => {
      const payment = buildPayment();
      mockPaymentRepo.findOne.mockResolvedValue(payment);

      const result = await service.checkInscriptionPaid('owner-1');
      expect(result.isPaid).toBe(true);
      expect(result.paymentId).toBe('payment-1');
    });

    it('returns isPaid=false when owner has no confirmed inscription', async () => {
      mockPaymentRepo.findOne.mockResolvedValue(null);

      const result = await service.checkInscriptionPaid('owner-1');
      expect(result.isPaid).toBe(false);
      expect(result.paymentId).toBeNull();
    });
  });
});
