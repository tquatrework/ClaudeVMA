import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsentRecordingService } from '../../src/consents/consent-recording.service';
import {
  ConsentRecord,
  ConsentType,
  DEFAULT_CONSENT_VERSION,
} from '../../src/consents/entities/consent-record.entity';

describe('ConsentRecordingService', () => {
  let service: ConsentRecordingService;
  let consentRepo: any;
  let transactionalConsentRepo: any;
  let entityManager: { getRepository: jest.Mock };

  const buildRepositoryMock = () => ({
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockImplementation((entity) => entity),
    save: jest.fn().mockImplementation(async (entity) => ({ id: 'consent-uuid', ...entity })),
  });

  beforeEach(async () => {
    consentRepo = buildRepositoryMock();
    transactionalConsentRepo = buildRepositoryMock();
    entityManager = { getRepository: jest.fn().mockReturnValue(transactionalConsentRepo) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentRecordingService,
        { provide: getRepositoryToken(ConsentRecord), useValue: consentRepo },
      ],
    }).compile();

    service = module.get<ConsentRecordingService>(ConsentRecordingService);
  });

  describe('recordConsent', () => {
    it('records the consent with its version, ip address and user', async () => {
      const record = await service.recordConsent({
        userId: 'user-uuid',
        consentType: ConsentType.RGPD,
        version: '2.0',
        ipAddress: '203.0.113.7',
      });

      expect(consentRepo.create).toHaveBeenCalledWith({
        userId: 'user-uuid',
        consentType: ConsentType.RGPD,
        version: '2.0',
        ipAddress: '203.0.113.7',
      });
      expect(record.id).toBe('consent-uuid');
    });

    it('falls back to the default version when the caller provides none', async () => {
      await service.recordConsent({ userId: 'user-uuid', consentType: ConsentType.CGU });

      expect(consentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ version: DEFAULT_CONSENT_VERSION }),
      );
    });

    it('writes through the caller transaction manager when one is provided', async () => {
      await service.recordConsent(
        { userId: 'user-uuid', consentType: ConsentType.RGPD },
        entityManager as never,
      );

      expect(entityManager.getRepository).toHaveBeenCalledWith(ConsentRecord);
      expect(transactionalConsentRepo.save).toHaveBeenCalled();
      expect(consentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('findSignedConsent', () => {
    it('returns the existing record for that consent type', async () => {
      consentRepo.findOne.mockResolvedValue({ id: 'existing', consentType: ConsentType.RGPD });

      const found = await service.findSignedConsent('user-uuid', ConsentType.RGPD);

      expect(found).toEqual({ id: 'existing', consentType: ConsentType.RGPD });
      expect(consentRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-uuid', consentType: ConsentType.RGPD },
      });
    });

    it('returns null when nothing was signed yet', async () => {
      await expect(service.findSignedConsent('user-uuid', ConsentType.CGU)).resolves.toBeNull();
    });
  });

  describe('listSignedConsents', () => {
    it('returns the consents ordered from the oldest signature', async () => {
      const records = [{ id: '1', consentType: ConsentType.RGPD }];
      consentRepo.find.mockResolvedValue(records);

      await expect(service.listSignedConsents('user-uuid')).resolves.toEqual(records);
      expect(consentRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        order: { signedAt: 'ASC' },
      });
    });
  });

  describe('areMandatoryConsentsSigned', () => {
    it('is true once both rgpd and cgu are signed', async () => {
      consentRepo.find.mockResolvedValue([
        { consentType: ConsentType.RGPD },
        { consentType: ConsentType.CGU },
      ]);

      await expect(service.areMandatoryConsentsSigned('user-uuid')).resolves.toBe(true);
    });

    it('is false when only one mandatory consent is signed', async () => {
      consentRepo.find.mockResolvedValue([{ consentType: ConsentType.RGPD }]);

      await expect(service.areMandatoryConsentsSigned('user-uuid')).resolves.toBe(false);
    });

    it('is false when only an optional consent is signed', async () => {
      consentRepo.find.mockResolvedValue([{ consentType: ConsentType.MARKETING }]);

      await expect(service.areMandatoryConsentsSigned('user-uuid')).resolves.toBe(false);
    });

    it('is false when nothing is signed', async () => {
      await expect(service.areMandatoryConsentsSigned('user-uuid')).resolves.toBe(false);
    });
  });
});
