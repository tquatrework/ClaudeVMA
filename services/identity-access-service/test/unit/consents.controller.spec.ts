import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConsentsController } from '../../src/consents/consents.controller';
import { ConsentsService } from '../../src/consents/consents.service';
import { ConsentAction, ConsentType } from '../../src/consents/entities/consent-record.entity';
import { ConsentStatus } from '../../src/consents/dto/consent-state.dto';
import { makeAuthenticatedUser } from './helpers/authenticated-user.factory';

const makeConsentRecord = (overrides = {}) => ({
  id: 'consent-uuid',
  userId: 'user-uuid',
  consentType: ConsentType.RGPD,
  action: ConsentAction.GRANTED,
  version: '1.0',
  ipAddress: '127.0.0.1',
  recordedAt: new Date(),
  ...overrides,
});

const makeConsentState = (overrides = {}) => ({
  consentType: ConsentType.MARKETING,
  status: ConsentStatus.GRANTED,
  isGranted: true,
  isMandatory: false,
  isWithdrawable: true,
  version: '1.0',
  grantedAt: new Date(),
  withdrawnAt: null,
  updatedAt: new Date(),
  ...overrides,
});

const mockConsentsService = {
  signConsent: jest.fn(),
  withdrawConsent: jest.fn(),
  getConsentStates: jest.fn(),
  getConsentHistory: jest.fn(),
};

describe('ConsentsController', () => {
  let controller: ConsentsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ConsentsController],
      providers: [{ provide: ConsentsService, useValue: mockConsentsService }],
    }).compile();

    controller = module.get<ConsentsController>(ConsentsController);
  });

  // ── POST /consents ───────────────────────────────────────────────────────────

  describe('POST /consents — signConsent', () => {
    it('records a new RGPD consent for the authenticated user', async () => {
      const consentRecord = makeConsentRecord();
      mockConsentsService.signConsent.mockResolvedValue(consentRecord);

      const actor = makeAuthenticatedUser({ id: 'user-uuid' });
      const result = await controller.signConsent(
        { consentType: ConsentType.RGPD },
        actor,
        '127.0.0.1',
      );

      expect(result).toEqual(consentRecord);
      expect(mockConsentsService.signConsent).toHaveBeenCalledWith(
        'user-uuid',
        { consentType: ConsentType.RGPD },
        '127.0.0.1',
      );
    });

    it('records a CGU consent for the authenticated user', async () => {
      const consentRecord = makeConsentRecord({ consentType: ConsentType.CGU });
      mockConsentsService.signConsent.mockResolvedValue(consentRecord);

      const actor = makeAuthenticatedUser({ id: 'user-uuid' });
      const result = await controller.signConsent(
        { consentType: ConsentType.CGU },
        actor,
        '127.0.0.1',
      );

      expect(result.consentType).toBe(ConsentType.CGU);
    });

    it('propagates 409 when the consent type is already granted', async () => {
      mockConsentsService.signConsent.mockRejectedValue(
        new ConflictException('Consent rgpd already granted'),
      );

      const actor = makeAuthenticatedUser({ id: 'user-uuid' });

      await expect(
        controller.signConsent({ consentType: ConsentType.RGPD }, actor, '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });

    it('uses the authenticated user id from the JWT token, not from the request body', async () => {
      const consentRecord = makeConsentRecord();
      mockConsentsService.signConsent.mockResolvedValue(consentRecord);

      const actor = makeAuthenticatedUser({ id: 'jwt-user-uuid' });
      await controller.signConsent({ consentType: ConsentType.RGPD }, actor, '127.0.0.1');

      expect(mockConsentsService.signConsent).toHaveBeenCalledWith(
        'jwt-user-uuid',
        expect.any(Object),
        expect.any(String),
      );
    });
  });

  // ── POST /consents/:consentType/withdraw ─────────────────────────────────────

  describe('POST /consents/:consentType/withdraw — withdrawConsent', () => {
    it('withdraws the marketing consent of the authenticated user', async () => {
      const withdrawalRecord = makeConsentRecord({
        consentType: ConsentType.MARKETING,
        action: ConsentAction.WITHDRAWN,
      });
      mockConsentsService.withdrawConsent.mockResolvedValue(withdrawalRecord);

      const actor = makeAuthenticatedUser({ id: 'user-uuid' });
      const result = await controller.withdrawConsent(ConsentType.MARKETING, actor, '127.0.0.1');

      expect(result.action).toBe(ConsentAction.WITHDRAWN);
      expect(mockConsentsService.withdrawConsent).toHaveBeenCalledWith(
        'user-uuid',
        ConsentType.MARKETING,
        '127.0.0.1',
      );
    });

    it('propagates 403 when the consent is mandatory', async () => {
      mockConsentsService.withdrawConsent.mockRejectedValue(
        new ForbiddenException('Consent rgpd is mandatory and cannot be withdrawn'),
      );

      const actor = makeAuthenticatedUser({ id: 'user-uuid' });

      await expect(
        controller.withdrawConsent(ConsentType.RGPD, actor, '127.0.0.1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propagates 404 when the consent was never granted', async () => {
      mockConsentsService.withdrawConsent.mockRejectedValue(
        new NotFoundException('No marketing consent to withdraw'),
      );

      const actor = makeAuthenticatedUser({ id: 'user-uuid' });

      await expect(
        controller.withdrawConsent(ConsentType.MARKETING, actor, '127.0.0.1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('propagates 409 on a second withdrawal', async () => {
      mockConsentsService.withdrawConsent.mockRejectedValue(
        new ConflictException('Consent marketing is already withdrawn'),
      );

      const actor = makeAuthenticatedUser({ id: 'user-uuid' });

      await expect(
        controller.withdrawConsent(ConsentType.MARKETING, actor, '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });

    it('uses the authenticated user id from the JWT token, never a user id from the path', async () => {
      mockConsentsService.withdrawConsent.mockResolvedValue(makeConsentRecord());

      const actor = makeAuthenticatedUser({ id: 'jwt-user-uuid' });
      await controller.withdrawConsent(ConsentType.MARKETING, actor, '127.0.0.1');

      expect(mockConsentsService.withdrawConsent).toHaveBeenCalledWith(
        'jwt-user-uuid',
        ConsentType.MARKETING,
        '127.0.0.1',
      );
    });
  });

  // ── GET /consents ────────────────────────────────────────────────────────────

  describe('GET /consents — getMyConsents', () => {
    it('returns the current state of every consent type', async () => {
      const consentStates = [
        makeConsentState({ consentType: ConsentType.RGPD, isMandatory: true, isWithdrawable: false }),
        makeConsentState({ consentType: ConsentType.CGU, isMandatory: true, isWithdrawable: false }),
        makeConsentState({ consentType: ConsentType.MARKETING, status: ConsentStatus.WITHDRAWN }),
      ];
      mockConsentsService.getConsentStates.mockResolvedValue(consentStates);

      const actor = makeAuthenticatedUser({ id: 'user-uuid' });
      const result = await controller.getMyConsents(actor);

      expect(result).toHaveLength(3);
      expect(mockConsentsService.getConsentStates).toHaveBeenCalledWith('user-uuid');
    });

    it('uses the authenticated user id from the JWT token', async () => {
      mockConsentsService.getConsentStates.mockResolvedValue([]);

      const actor = makeAuthenticatedUser({ id: 'jwt-user-uuid' });
      await controller.getMyConsents(actor);

      expect(mockConsentsService.getConsentStates).toHaveBeenCalledWith('jwt-user-uuid');
    });
  });

  // ── GET /consents/history ────────────────────────────────────────────────────

  describe('GET /consents/history — getMyConsentHistory', () => {
    it('returns the consent journal of the authenticated user', async () => {
      mockConsentsService.getConsentHistory.mockResolvedValue([
        { id: '1', consentType: ConsentType.MARKETING, action: ConsentAction.GRANTED },
        { id: '2', consentType: ConsentType.MARKETING, action: ConsentAction.WITHDRAWN },
      ]);

      const actor = makeAuthenticatedUser({ id: 'user-uuid' });
      const result = await controller.getMyConsentHistory(actor);

      expect(result).toHaveLength(2);
      expect(mockConsentsService.getConsentHistory).toHaveBeenCalledWith('user-uuid');
    });

    it('returns an empty journal when the user never consented to anything', async () => {
      mockConsentsService.getConsentHistory.mockResolvedValue([]);

      const actor = makeAuthenticatedUser({ id: 'user-uuid' });

      await expect(controller.getMyConsentHistory(actor)).resolves.toEqual([]);
    });
  });
});
