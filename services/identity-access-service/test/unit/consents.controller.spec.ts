import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { ConsentsController } from '../../src/consents/consents.controller';
import { ConsentsService } from '../../src/consents/consents.service';
import { ConsentType } from '../../src/consents/entities/consent-record.entity';

const makeConsentRecord = (overrides = {}) => ({
  id: 'consent-uuid',
  userId: 'user-uuid',
  consentType: ConsentType.RGPD,
  version: '1.0',
  ipAddress: '127.0.0.1',
  signedAt: new Date(),
  ...overrides,
});

const mockConsentsService = {
  signConsent: jest.fn(),
  getConsents: jest.fn(),
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

      const mockRequest = { user: { id: 'user-uuid' } };
      const result = await controller.signConsent(
        { consentType: ConsentType.RGPD },
        mockRequest,
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

      const mockRequest = { user: { id: 'user-uuid' } };
      const result = await controller.signConsent(
        { consentType: ConsentType.CGU },
        mockRequest,
        '127.0.0.1',
      );

      expect(result.consentType).toBe(ConsentType.CGU);
    });

    it('propagates 409 when the same consent type is signed twice', async () => {
      mockConsentsService.signConsent.mockRejectedValue(
        new ConflictException('Consent rgpd already signed'),
      );

      const mockRequest = { user: { id: 'user-uuid' } };

      await expect(
        controller.signConsent({ consentType: ConsentType.RGPD }, mockRequest, '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });

    it('uses the authenticated user id from the JWT token, not from the request body', async () => {
      const consentRecord = makeConsentRecord();
      mockConsentsService.signConsent.mockResolvedValue(consentRecord);

      const mockRequest = { user: { id: 'jwt-user-uuid' } };
      await controller.signConsent({ consentType: ConsentType.RGPD }, mockRequest, '127.0.0.1');

      expect(mockConsentsService.signConsent).toHaveBeenCalledWith(
        'jwt-user-uuid',
        expect.any(Object),
        expect.any(String),
      );
    });
  });

  // ── GET /consents ────────────────────────────────────────────────────────────

  describe('GET /consents — getMyConsents', () => {
    it('returns all consents signed by the authenticated user', async () => {
      const consents = [
        makeConsentRecord({ consentType: ConsentType.RGPD }),
        makeConsentRecord({ id: 'consent-uuid-2', consentType: ConsentType.CGU }),
      ];
      mockConsentsService.getConsents.mockResolvedValue(consents);

      const mockRequest = { user: { id: 'user-uuid' } };
      const result = await controller.getMyConsents(mockRequest);

      expect(result).toHaveLength(2);
      expect(mockConsentsService.getConsents).toHaveBeenCalledWith('user-uuid');
    });

    it('returns an empty list when the user has not signed any consents', async () => {
      mockConsentsService.getConsents.mockResolvedValue([]);

      const mockRequest = { user: { id: 'user-uuid' } };
      const result = await controller.getMyConsents(mockRequest);

      expect(result).toEqual([]);
    });

    it('uses the authenticated user id from the JWT token', async () => {
      mockConsentsService.getConsents.mockResolvedValue([]);

      const mockRequest = { user: { id: 'jwt-user-uuid' } };
      await controller.getMyConsents(mockRequest);

      expect(mockConsentsService.getConsents).toHaveBeenCalledWith('jwt-user-uuid');
    });
  });
});
