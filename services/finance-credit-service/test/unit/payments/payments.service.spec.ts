import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PaymentsService } from '../../../src/payments/payments.service';
import { Payment, PaymentType, PaymentStatus } from '../../../src/payments/entities/payment.entity';
import { Invoice, InvoiceStatus } from '../../../src/payments/entities/invoice.entity';
import { FinancialPointLedger, LedgerEntryType } from '../../../src/payments/entities/financial-point-ledger.entity';
import { FinancialArchiveItem, ArchiveItemType } from '../../../src/financial-archives/entities/financial-archive-item.entity';
import { FinancialProfilesService } from '../../../src/financial-profiles/financial-profiles.service';
import { EventsService } from '../../../src/events/events.service';
import { FinancialProfileType } from '../../../src/financial-profiles/entities/financial-profile.entity';

// ---- Repository mocks used inside the transaction manager ----

const mockPaymentRepoInner = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockInvoiceRepoInner = {
  save: jest.fn(),
  create: jest.fn(),
};

const mockLedgerRepoInner = {
  save: jest.fn(),
  create: jest.fn(),
};

const mockArchiveRepoInner = {
  save: jest.fn(),
  create: jest.fn(),
};

// ---- Top-level repository mocks (used for reads outside the transaction) ----

const mockPaymentRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
};

const mockInvoiceRepo = {
  findOne: jest.fn(),
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

/**
 * Build a mock DataSource whose transaction() method executes the callback
 * with a manager that returns pre-configured inner repository mocks.
 */
const buildMockDataSource = () => ({
  transaction: jest.fn().mockImplementation(async (callback: (manager: unknown) => Promise<unknown>) => {
    const manager = {
      getRepository: (entityClass: unknown) => {
        if (entityClass === Payment) return mockPaymentRepoInner;
        if (entityClass === Invoice) return mockInvoiceRepoInner;
        if (entityClass === FinancialPointLedger) return mockLedgerRepoInner;
        if (entityClass === FinancialArchiveItem) return mockArchiveRepoInner;
        throw new Error(`Unexpected entity class in transaction manager: ${String(entityClass)}`);
      },
    };
    return callback(manager);
  }),
});

const buildPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'payment-1',
  ownerId: 'owner-1',
  paymentType: PaymentType.INSCRIPTION,
  amountCents: 9900,
  paymentStatus: PaymentStatus.CONFIRMED,
  externalReference: null,
  idempotencyKey: null,
  correlationId: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
});

const buildInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'invoice-1',
  paymentId: 'payment-1',
  invoiceNumber: 'VM-20260101-PAYMENT1',
  ownerId: 'owner-1',
  amountCents: 9900,
  invoiceStatus: InvoiceStatus.ISSUED,
  correlationId: null,
  issuedAt: new Date('2026-01-01'),
  ...overrides,
});

const buildProfile = (pointsBalance = 0) => ({
  id: 'profile-1',
  ownerId: 'owner-1',
  profileType: FinancialProfileType.MEMBRE,
  pointsBalance,
  fundingEndDate: null,
  paymentMethod: null,
  paymentReference: null,
  correlationId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('PaymentsService', () => {
  let service: PaymentsService;
  let mockDataSource: ReturnType<typeof buildMockDataSource>;

  beforeEach(async () => {
    mockDataSource = buildMockDataSource();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: getRepositoryToken(Payment), useValue: mockPaymentRepo },
        { provide: getRepositoryToken(Invoice), useValue: mockInvoiceRepo },
        { provide: getRepositoryToken(FinancialPointLedger), useValue: mockLedgerRepo },
        { provide: getRepositoryToken(FinancialArchiveItem), useValue: mockArchiveRepo },
        { provide: FinancialProfilesService, useValue: mockFinancialProfilesService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    jest.clearAllMocks();

    // Re-assign the transaction mock after clearAllMocks
    mockDataSource.transaction.mockImplementation(async (callback: (manager: unknown) => Promise<unknown>) => {
      const manager = {
        getRepository: (entityClass: unknown) => {
          if (entityClass === Payment) return mockPaymentRepoInner;
          if (entityClass === Invoice) return mockInvoiceRepoInner;
          if (entityClass === FinancialPointLedger) return mockLedgerRepoInner;
          if (entityClass === FinancialArchiveItem) return mockArchiveRepoInner;
          throw new Error(`Unexpected entity class in transaction manager: ${String(entityClass)}`);
        },
      };
      return callback(manager);
    });
  });

  // ---- initiatePayment — nominal ----

  describe('initiatePayment', () => {
    it('creates a confirmed inscription payment, invoice, ledger entry and archive item', async () => {
      const payment = buildPayment();
      const invoice = buildInvoice();
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

      // No existing idempotency match and no active inscription
      mockPaymentRepo.findOne.mockResolvedValue(null);

      // Inner transaction repos
      mockPaymentRepoInner.create.mockReturnValue(payment);
      mockPaymentRepoInner.save.mockResolvedValue(payment);
      mockInvoiceRepoInner.create.mockReturnValue(invoice);
      mockInvoiceRepoInner.save.mockResolvedValue(invoice);
      mockFinancialProfilesService.createOrUpgradeToMembre.mockResolvedValue(buildProfile());
      mockLedgerRepoInner.create.mockReturnValue({});
      mockLedgerRepoInner.save.mockResolvedValue({});
      mockFinancialProfilesService.updatePointsBalance.mockResolvedValue(undefined);
      mockArchiveRepoInner.create.mockReturnValue(archiveItem);
      mockArchiveRepoInner.save.mockResolvedValue(archiveItem);

      const result = await service.initiatePayment('owner-1', {
        paymentType: PaymentType.INSCRIPTION,
        amountCents: 9900,
      });

      expect(result.payment.id).toBe('payment-1');
      expect(result.invoice.id).toBe('invoice-1');
      expect(mockFinancialProfilesService.createOrUpgradeToMembre).toHaveBeenCalledWith('owner-1', null);
      expect(mockLedgerRepoInner.save).toHaveBeenCalledTimes(1);
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
      const invoice = buildInvoice({ amountCents: 19900 });
      const archiveItem = { id: 'archive-2', occurredAt: new Date() };

      mockPaymentRepo.findOne.mockResolvedValue(null);
      mockPaymentRepoInner.create.mockReturnValue(payment);
      mockPaymentRepoInner.save.mockResolvedValue(payment);
      mockInvoiceRepoInner.create.mockReturnValue(invoice);
      mockInvoiceRepoInner.save.mockResolvedValue(invoice);
      mockFinancialProfilesService.createOrUpgradeToMembre.mockResolvedValue(buildProfile(0));
      mockLedgerRepoInner.create.mockReturnValue({});
      mockLedgerRepoInner.save.mockResolvedValue({});
      mockFinancialProfilesService.updatePointsBalance.mockResolvedValue(undefined);
      mockArchiveRepoInner.create.mockReturnValue(archiveItem);
      mockArchiveRepoInner.save.mockResolvedValue(archiveItem);

      await service.initiatePayment('owner-1', {
        paymentType: PaymentType.INSCRIPTION,
        amountCents: 19900,
      });

      expect(mockLedgerRepoInner.create).toHaveBeenCalledWith(
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
      const invoice = buildInvoice();
      const archiveItem = { id: 'archive-3', occurredAt: new Date() };

      mockPaymentRepoInner.create.mockReturnValue(payment);
      mockPaymentRepoInner.save.mockResolvedValue(payment);
      mockInvoiceRepoInner.create.mockReturnValue(invoice);
      mockInvoiceRepoInner.save.mockResolvedValue(invoice);
      mockArchiveRepoInner.create.mockReturnValue(archiveItem);
      mockArchiveRepoInner.save.mockResolvedValue(archiveItem);

      await service.initiatePayment('owner-1', {
        paymentType: PaymentType.VERSEMENT_PONCTUEL,
        amountCents: 5000,
      });

      expect(mockLedgerRepoInner.save).not.toHaveBeenCalled();
      expect(mockFinancialProfilesService.createOrUpgradeToMembre).not.toHaveBeenCalled();
    });

    it('throws ConflictException when owner already has a confirmed inscription (FIN-AC-002)', async () => {
      // No idempotency key so no idempotency findOne call; then the inscription guard triggers
      mockPaymentRepo.findOne.mockResolvedValue(buildPayment());

      await expect(
        service.initiatePayment('owner-1', {
          paymentType: PaymentType.INSCRIPTION,
          amountCents: 9900,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates correlationId to payment and events', async () => {
      const payment = buildPayment({ correlationId: 'corr-abc' });
      const invoice = buildInvoice({ correlationId: 'corr-abc' });
      const archiveItem = { id: 'archive-4', occurredAt: new Date() };

      mockPaymentRepo.findOne.mockResolvedValue(null);
      mockPaymentRepoInner.create.mockReturnValue(payment);
      mockPaymentRepoInner.save.mockResolvedValue(payment);
      mockInvoiceRepoInner.create.mockReturnValue(invoice);
      mockInvoiceRepoInner.save.mockResolvedValue(invoice);
      mockFinancialProfilesService.createOrUpgradeToMembre.mockResolvedValue(buildProfile());
      mockLedgerRepoInner.create.mockReturnValue({});
      mockLedgerRepoInner.save.mockResolvedValue({});
      mockFinancialProfilesService.updatePointsBalance.mockResolvedValue(undefined);
      mockArchiveRepoInner.create.mockReturnValue(archiveItem);
      mockArchiveRepoInner.save.mockResolvedValue(archiveItem);

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

    // ---- Test rollback ----

    it('rolls back all writes when an error occurs inside the transaction', async () => {
      const payment = buildPayment();

      mockPaymentRepo.findOne.mockResolvedValue(null);

      // Simulate: payment saves OK, invoice save throws → transaction should roll back
      mockPaymentRepoInner.create.mockReturnValue(payment);
      mockPaymentRepoInner.save.mockResolvedValue(payment);
      mockInvoiceRepoInner.create.mockReturnValue({});
      mockInvoiceRepoInner.save.mockRejectedValue(new Error('DB error on invoice save'));

      // Override dataSource.transaction to simulate rollback: re-run the callback but let it throw
      mockDataSource.transaction.mockImplementation(async (callback: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: (entityClass: unknown) => {
            if (entityClass === Payment) return mockPaymentRepoInner;
            if (entityClass === Invoice) return mockInvoiceRepoInner;
            if (entityClass === FinancialPointLedger) return mockLedgerRepoInner;
            if (entityClass === FinancialArchiveItem) return mockArchiveRepoInner;
            throw new Error(`Unexpected entity class`);
          },
        };
        // The real DataSource would roll back; here we just let the error propagate
        return callback(manager);
      });

      await expect(
        service.initiatePayment('owner-1', {
          paymentType: PaymentType.INSCRIPTION,
          amountCents: 9900,
        }),
      ).rejects.toThrow('DB error on invoice save');

      // Events must NOT be published because the transaction failed
      expect(mockEventsService.publish).not.toHaveBeenCalled();
      // Ledger and archive must NOT have been called (error happened before them)
      expect(mockLedgerRepoInner.save).not.toHaveBeenCalled();
      expect(mockArchiveRepoInner.save).not.toHaveBeenCalled();
    });

    // ---- Test idempotence ----

    it('returns existing payment without re-executing the workflow when idempotencyKey matches', async () => {
      const existingPayment = buildPayment({ idempotencyKey: 'idem-key-pay-1' });
      const existingInvoice = buildInvoice();

      // First findOne for idempotency check (by ownerId + idempotencyKey)
      mockPaymentRepo.findOne.mockResolvedValueOnce(existingPayment);
      // Second findOne for invoice lookup
      mockInvoiceRepo.findOne.mockResolvedValueOnce(existingInvoice);

      const result = await service.initiatePayment('owner-1', {
        paymentType: PaymentType.INSCRIPTION,
        amountCents: 9900,
        idempotencyKey: 'idem-key-pay-1',
      });

      expect(result.payment.id).toBe('payment-1');
      expect(result.invoice.id).toBe('invoice-1');
      // No writes and no events should have been triggered
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
      expect(mockPaymentRepoInner.save).not.toHaveBeenCalled();
      expect(mockEventsService.publish).not.toHaveBeenCalled();
    });

    it('proceeds normally when idempotencyKey is provided but does not match any existing payment', async () => {
      const payment = buildPayment({ idempotencyKey: 'idem-key-new' });
      const invoice = buildInvoice();
      const archiveItem = { id: 'archive-5', occurredAt: new Date() };

      // Idempotency check finds nothing
      mockPaymentRepo.findOne.mockResolvedValueOnce(null);
      // Inscription guard check finds nothing (no existing inscription)
      mockPaymentRepo.findOne.mockResolvedValueOnce(null);

      mockPaymentRepoInner.create.mockReturnValue(payment);
      mockPaymentRepoInner.save.mockResolvedValue(payment);
      mockInvoiceRepoInner.create.mockReturnValue(invoice);
      mockInvoiceRepoInner.save.mockResolvedValue(invoice);
      mockFinancialProfilesService.createOrUpgradeToMembre.mockResolvedValue(buildProfile());
      mockLedgerRepoInner.create.mockReturnValue({});
      mockLedgerRepoInner.save.mockResolvedValue({});
      mockFinancialProfilesService.updatePointsBalance.mockResolvedValue(undefined);
      mockArchiveRepoInner.create.mockReturnValue(archiveItem);
      mockArchiveRepoInner.save.mockResolvedValue(archiveItem);

      const result = await service.initiatePayment('owner-1', {
        paymentType: PaymentType.INSCRIPTION,
        amountCents: 9900,
        idempotencyKey: 'idem-key-new',
      });

      expect(result.payment.id).toBe('payment-1');
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockEventsService.publish).toHaveBeenCalledTimes(2);
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
