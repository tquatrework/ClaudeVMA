import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeacherPaymentRequestsService,
        { provide: getRepositoryToken(TeacherPaymentRequest), useValue: mockRequestRepo },
        { provide: getRepositoryToken(FinancialPointLedger), useValue: mockLedgerRepo },
        { provide: getRepositoryToken(FinancialArchiveItem), useValue: mockArchiveRepo },
        { provide: FinancialProfilesService, useValue: mockFinancialProfilesService },
        { provide: EventsService, useValue: mockEventsService },
      ],
    }).compile();

    service = module.get<TeacherPaymentRequestsService>(TeacherPaymentRequestsService);
    jest.clearAllMocks();
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
      mockLedgerRepo.create.mockReturnValue({});
      mockLedgerRepo.save.mockResolvedValue({});
      mockArchiveRepo.create.mockReturnValue({});
      mockArchiveRepo.save.mockResolvedValue({});
      mockFinancialProfilesService.updatePointsBalance.mockResolvedValue(undefined);
      mockRequestRepo.save.mockResolvedValue(validatedRequest);

      const result = await service.validateRequest(
        'request-1',
        { decision: ValidationDecision.VALIDATED },
        'af-user',
        UserRole.ADMINISTRATEUR_FINANCIER,
      );

      expect(result.requestStatus).toBe(TeacherPaymentRequestStatus.VALIDATED);
      // 12000 cents = 120 points debited
      expect(mockLedgerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: LedgerEntryType.DEBIT,
          pointsAmount: 120,
          balanceAfter: 380, // 500 - 120
        }),
      );
      expect(mockFinancialProfilesService.updatePointsBalance).toHaveBeenCalledWith('owner-1', 380);
      expect(mockArchiveRepo.save).toHaveBeenCalledTimes(1);
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
      mockRequestRepo.save.mockResolvedValue(rejectedRequest);

      const result = await service.validateRequest(
        'request-1',
        { decision: ValidationDecision.REJECTED, rejectionReason: 'Facture non conforme' },
        'af-user',
        UserRole.ADMINISTRATEUR_FINANCIER,
      );

      expect(result.requestStatus).toBe(TeacherPaymentRequestStatus.REJECTED);
      expect(mockLedgerRepo.save).not.toHaveBeenCalled();
      expect(mockArchiveRepo.save).not.toHaveBeenCalled();
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
});
