import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TeacherPaymentRequestsService } from '../../../src/teacher-payment-requests/teacher-payment-requests.service';
import {
  TeacherPaymentRequest,
  TeacherPaymentRequestStatus,
} from '../../../src/teacher-payment-requests/entities/teacher-payment-request.entity';
import { FinancialPointLedger, LedgerEntryType } from '../../../src/payments/entities/financial-point-ledger.entity';
import {
  FinancialArchiveItem,
  ArchiveItemType,
} from '../../../src/financial-archives/entities/financial-archive-item.entity';
import { FinancialProfilesService } from '../../../src/financial-profiles/financial-profiles.service';
import { EventsService } from '../../../src/events/events.service';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import {
  ValidationDecision,
} from '../../../src/teacher-payment-requests/dto/validate-teacher-payment-request.dto';
import { FinancialProfileType } from '../../../src/financial-profiles/entities/financial-profile.entity';

// ---- Repository mocks used inside the transaction manager ----

const mockRequestRepoInner = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
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

const mockRequestRepo = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
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
  findByOwnerId: jest.fn(),
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
        if (entityClass === TeacherPaymentRequest) return mockRequestRepoInner;
        if (entityClass === FinancialPointLedger) return mockLedgerRepoInner;
        if (entityClass === FinancialArchiveItem) return mockArchiveRepoInner;
        throw new Error(`Unexpected entity class in transaction manager: ${String(entityClass)}`);
      },
    };
    return callback(manager);
  }),
});

const buildRequest = (
  overrides: Partial<TeacherPaymentRequest> = {},
): TeacherPaymentRequest => ({
  id: 'request-1',
  teacherId: 'teacher-1',
  fundingOwnerId: 'owner-1',
  studentId: 'student-1',
  amountCents: 12000,
  description: 'Cours maths — 2h',
  invoiceReference: 'FACT-001',
  requestStatus: TeacherPaymentRequestStatus.PENDING,
  rejectionReason: null,
  reviewedBy: null,
  idempotencyKey: null,
  correlationId: null,
  createdAt: new Date('2026-06-01'),
  updatedAt: new Date('2026-06-01'),
  ...overrides,
});

const buildProfile = (pointsBalance = 500) => ({
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

describe('TeacherPaymentRequestsService', () => {
  let service: TeacherPaymentRequestsService;
  let mockDataSource: ReturnType<typeof buildMockDataSource>;

  beforeEach(async () => {
    mockDataSource = buildMockDataSource();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherPaymentRequestsService,
        { provide: getRepositoryToken(TeacherPaymentRequest), useValue: mockRequestRepo },
        { provide: getRepositoryToken(FinancialPointLedger), useValue: mockLedgerRepo },
        { provide: getRepositoryToken(FinancialArchiveItem), useValue: mockArchiveRepo },
        { provide: FinancialProfilesService, useValue: mockFinancialProfilesService },
        { provide: EventsService, useValue: mockEventsService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<TeacherPaymentRequestsService>(TeacherPaymentRequestsService);
    jest.clearAllMocks();

    // Re-assign the transaction mock after clearAllMocks
    mockDataSource.transaction.mockImplementation(async (callback: (manager: unknown) => Promise<unknown>) => {
      const manager = {
        getRepository: (entityClass: unknown) => {
          if (entityClass === TeacherPaymentRequest) return mockRequestRepoInner;
          if (entityClass === FinancialPointLedger) return mockLedgerRepoInner;
          if (entityClass === FinancialArchiveItem) return mockArchiveRepoInner;
          throw new Error(`Unexpected entity class in transaction manager: ${String(entityClass)}`);
        },
      };
      return callback(manager);
    });
  });

  // ---- createRequest ----

  describe('createRequest', () => {
    it('creates a payment request and publishes TeacherPaymentRequested event', async () => {
      const savedRequest = buildRequest();
      mockRequestRepo.findOne.mockResolvedValue(null); // no idempotency match
      mockRequestRepo.create.mockReturnValue(savedRequest);
      mockRequestRepo.save.mockResolvedValue(savedRequest);

      const result = await service.createRequest('teacher-1', {
        fundingOwnerId: 'owner-1',
        studentId: 'student-1',
        amountCents: 12000,
        description: 'Cours maths — 2h',
        invoiceReference: 'FACT-001',
      });

      expect(result.id).toBe('request-1');
      expect(mockRequestRepo.save).toHaveBeenCalledTimes(1);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'TeacherPaymentRequested',
        expect.objectContaining({ requestId: 'request-1', teacherId: 'teacher-1' }),
        undefined,
      );
    });

    it('returns existing request when idempotency key matches', async () => {
      const existingRequest = buildRequest({ idempotencyKey: 'idem-key-1' });
      mockRequestRepo.findOne.mockResolvedValue(existingRequest);

      const result = await service.createRequest('teacher-1', {
        fundingOwnerId: 'owner-1',
        amountCents: 12000,
        description: 'Cours maths — 2h',
        idempotencyKey: 'idem-key-1',
      });

      expect(result.id).toBe('request-1');
      expect(mockRequestRepo.save).not.toHaveBeenCalled();
      expect(mockEventsService.publish).not.toHaveBeenCalled();
    });

    it('propagates correlationId from dto', async () => {
      const savedRequest = buildRequest({ correlationId: 'corr-xyz' });
      mockRequestRepo.findOne.mockResolvedValue(null);
      mockRequestRepo.create.mockReturnValue(savedRequest);
      mockRequestRepo.save.mockResolvedValue(savedRequest);

      await service.createRequest('teacher-1', {
        fundingOwnerId: 'owner-1',
        amountCents: 12000,
        description: 'Cours maths — 2h',
        correlationId: 'corr-xyz',
      });

      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'TeacherPaymentRequested',
        expect.any(Object),
        'corr-xyz',
      );
    });
  });

  // ---- validateRequest ----

  describe('validateRequest', () => {
    it('validates request, debits points, creates ledger entry and archive item', async () => {
      const pendingRequest = buildRequest();
      const fundingProfile = buildProfile(500);
      const validatedRequest = buildRequest({
        requestStatus: TeacherPaymentRequestStatus.VALIDATED,
        reviewedBy: 'af-user',
      });

      mockRequestRepo.findOne.mockResolvedValue(pendingRequest);
      mockFinancialProfilesService.findByOwnerId.mockResolvedValue(fundingProfile);
      mockLedgerRepoInner.create.mockReturnValue({});
      mockLedgerRepoInner.save.mockResolvedValue({});
      mockArchiveRepoInner.create.mockReturnValue({});
      mockArchiveRepoInner.save.mockResolvedValue({});
      mockFinancialProfilesService.updatePointsBalance.mockResolvedValue(undefined);
      mockRequestRepoInner.save.mockResolvedValue(validatedRequest);

      const result = await service.validateRequest(
        'request-1',
        { decision: ValidationDecision.VALIDATED },
        'af-user',
        UserRole.ADMINISTRATEUR_FINANCIER,
      );

      expect(result.requestStatus).toBe(TeacherPaymentRequestStatus.VALIDATED);
      // 12000 cents = 120 points debited
      expect(mockLedgerRepoInner.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: LedgerEntryType.DEBIT,
          pointsAmount: 120,
          balanceAfter: 380, // 500 - 120
        }),
      );
      expect(mockFinancialProfilesService.updatePointsBalance).toHaveBeenCalledWith('owner-1', 380);
      expect(mockArchiveRepoInner.save).toHaveBeenCalledTimes(1);
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'TeacherPaymentValidated',
        expect.objectContaining({ requestId: 'request-1', decision: ValidationDecision.VALIDATED }),
        undefined,
      );
    });

    it('rejects request and publishes PaymentIncidentDetected event', async () => {
      const pendingRequest = buildRequest();
      const rejectedRequest = buildRequest({
        requestStatus: TeacherPaymentRequestStatus.REJECTED,
        rejectionReason: 'Facture non conforme',
        reviewedBy: 'af-user',
      });

      mockRequestRepo.findOne.mockResolvedValue(pendingRequest);
      mockRequestRepoInner.save.mockResolvedValue(rejectedRequest);

      const result = await service.validateRequest(
        'request-1',
        { decision: ValidationDecision.REJECTED, rejectionReason: 'Facture non conforme' },
        'af-user',
        UserRole.ADMINISTRATEUR_FINANCIER,
      );

      expect(result.requestStatus).toBe(TeacherPaymentRequestStatus.REJECTED);
      expect(mockLedgerRepoInner.save).not.toHaveBeenCalled();
      expect(mockArchiveRepoInner.save).not.toHaveBeenCalled();
      expect(mockEventsService.publish).toHaveBeenCalledWith(
        'PaymentIncidentDetected',
        expect.objectContaining({ decision: ValidationDecision.REJECTED }),
        undefined,
      );
    });

    it('throws ForbiddenException when requester is not AF', async () => {
      await expect(
        service.validateRequest(
          'request-1',
          { decision: ValidationDecision.VALIDATED },
          'rp-user',
          UserRole.RESPONSABLE_PEDAGOGIQUE,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when request does not exist', async () => {
      mockRequestRepo.findOne.mockResolvedValue(null);

      await expect(
        service.validateRequest(
          'nonexistent',
          { decision: ValidationDecision.VALIDATED },
          'af-user',
          UserRole.ADMINISTRATEUR_FINANCIER,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when request is already processed', async () => {
      const alreadyValidated = buildRequest({
        requestStatus: TeacherPaymentRequestStatus.VALIDATED,
      });
      mockRequestRepo.findOne.mockResolvedValue(alreadyValidated);

      await expect(
        service.validateRequest(
          'request-1',
          { decision: ValidationDecision.VALIDATED },
          'af-user',
          UserRole.ADMINISTRATEUR_FINANCIER,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when rejecting without a rejection reason', async () => {
      const pendingRequest = buildRequest();
      mockRequestRepo.findOne.mockResolvedValue(pendingRequest);

      await expect(
        service.validateRequest(
          'request-1',
          { decision: ValidationDecision.REJECTED },
          'af-user',
          UserRole.ADMINISTRATEUR_FINANCIER,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    // ---- Test rollback ----

    it('rolls back all writes when an error occurs after the first save inside the transaction', async () => {
      const pendingRequest = buildRequest();
      const fundingProfile = buildProfile(500);

      mockRequestRepo.findOne.mockResolvedValue(pendingRequest);
      mockFinancialProfilesService.findByOwnerId.mockResolvedValue(fundingProfile);
      mockLedgerRepoInner.create.mockReturnValue({});

      // Simulate: ledger save succeeds, then archive save throws → transaction should roll back
      mockLedgerRepoInner.save.mockResolvedValue({});
      mockArchiveRepoInner.create.mockReturnValue({});
      mockArchiveRepoInner.save.mockRejectedValue(new Error('DB error on archive save'));

      // Override dataSource.transaction to simulate rollback: let the callback throw
      mockDataSource.transaction.mockImplementation(async (callback: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: (entityClass: unknown) => {
            if (entityClass === TeacherPaymentRequest) return mockRequestRepoInner;
            if (entityClass === FinancialPointLedger) return mockLedgerRepoInner;
            if (entityClass === FinancialArchiveItem) return mockArchiveRepoInner;
            throw new Error(`Unexpected entity class`);
          },
        };
        // The real DataSource would roll back; here we just let the error propagate
        return callback(manager);
      });

      await expect(
        service.validateRequest(
          'request-1',
          { decision: ValidationDecision.VALIDATED },
          'af-user',
          UserRole.ADMINISTRATEUR_FINANCIER,
        ),
      ).rejects.toThrow('DB error on archive save');

      // Events must NOT be published because the transaction failed
      expect(mockEventsService.publish).not.toHaveBeenCalled();
      // Request status update must NOT have been persisted (error happened before it)
      expect(mockRequestRepoInner.save).not.toHaveBeenCalled();
    });
  });

  // ---- findByTeacher ----

  describe('findByTeacher', () => {
    it('returns requests when requester is the teacher', async () => {
      const requests = [buildRequest(), buildRequest({ id: 'request-2' })];
      mockRequestRepo.find.mockResolvedValue(requests);

      const result = await service.findByTeacher('teacher-1', 'teacher-1', UserRole.FORMATEUR);
      expect(result).toHaveLength(2);
    });

    it('returns requests when requester is AF', async () => {
      const requests = [buildRequest()];
      mockRequestRepo.find.mockResolvedValue(requests);

      const result = await service.findByTeacher('teacher-1', 'af-user', UserRole.ADMINISTRATEUR_FINANCIER);
      expect(result).toHaveLength(1);
    });

    it('throws ForbiddenException when requester is a different teacher', async () => {
      await expect(
        service.findByTeacher('teacher-1', 'other-teacher', UserRole.FORMATEUR),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ---- Access driven by ownership, not by a role allowlist (2026-08-11) ----

  describe('findByTeacher — the teacher reads their own requests, whatever their role', () => {
    it.each([UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE])(
      'allows a %s to list their own payment requests',
      async (role) => {
        mockRequestRepo.find.mockResolvedValue([buildRequest({ teacherId: 'self-1' })]);

        const result = await service.findByTeacher('self-1', 'self-1', role);
        expect(result).toHaveLength(1);
      },
    );

    it.each([UserRole.FORMATEUR, UserRole.ANIMATEUR_PEDAGOGIQUE])(
      'returns an empty list (not an error) when a %s has no request yet',
      async (role) => {
        mockRequestRepo.find.mockResolvedValue([]);

        const result = await service.findByTeacher('self-1', 'self-1', role);
        expect(result).toEqual([]);
      },
    );
  });

  describe('findByTeacher — listing someone else stays restricted', () => {
    it.each([
      UserRole.FORMATEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.PARENT_FINANCEUR,
      UserRole.ELEVE,
    ])('denies a %s access to another teacher requests', async (role) => {
      await expect(
        service.findByTeacher('other-teacher', 'self-1', role),
      ).rejects.toThrow(ForbiddenException);
      expect(mockRequestRepo.find).not.toHaveBeenCalled();
    });

    it.each([
      UserRole.ADMINISTRATEUR_FINANCIER,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ])('still allows a %s to list another teacher requests', async (role) => {
      mockRequestRepo.find.mockResolvedValue([buildRequest({ teacherId: 'other-teacher' })]);

      const result = await service.findByTeacher('other-teacher', 'admin-1', role);
      expect(result).toHaveLength(1);
    });
  });
});
