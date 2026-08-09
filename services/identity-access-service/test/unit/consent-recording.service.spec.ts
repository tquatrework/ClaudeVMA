import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConsentRecordingService } from '../../src/consents/consent-recording.service';
import {
  ConsentAction,
  ConsentRecord,
  ConsentType,
  DEFAULT_CONSENT_VERSION,
} from '../../src/consents/entities/consent-record.entity';

/**
 * Événement du journal, avec un horodatage explicite : l'état courant se lit
 * comme le DERNIER événement d'un type, l'ordre est donc porteur de sens.
 */
const makeConsentEvent = (
  consentType: ConsentType,
  action: ConsentAction,
  recordedAt: string,
  overrides: Partial<ConsentRecord> = {},
) =>
  ({
    id: `${consentType}-${action}-${recordedAt}`,
    userId: 'user-uuid',
    consentType,
    action,
    version: DEFAULT_CONSENT_VERSION,
    recordedAt: new Date(recordedAt),
    ...overrides,
  }) as ConsentRecord;

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
        action: ConsentAction.GRANTED,
        version: '2.0',
        ipAddress: '203.0.113.7',
      });
      expect(record.id).toBe('consent-uuid');
    });

    it('defaults to a grant when the caller does not specify an action', async () => {
      await service.recordConsent({ userId: 'user-uuid', consentType: ConsentType.RGPD });

      expect(consentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: ConsentAction.GRANTED }),
      );
    });

    it('appends a withdrawal event instead of deleting or updating anything', async () => {
      await service.recordConsent({
        userId: 'user-uuid',
        consentType: ConsentType.MARKETING,
        action: ConsentAction.WITHDRAWN,
      });

      expect(consentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: ConsentAction.WITHDRAWN }),
      );
      expect(consentRepo.save).toHaveBeenCalled();
      expect(consentRepo.delete).toBeUndefined();
      expect(consentRepo.update).toBeUndefined();
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

  describe('findCurrentConsent', () => {
    it('returns the most recent event for that consent type', async () => {
      const latestEvent = makeConsentEvent(
        ConsentType.MARKETING,
        ConsentAction.WITHDRAWN,
        '2026-08-09T10:00:00Z',
      );
      consentRepo.findOne.mockResolvedValue(latestEvent);

      const found = await service.findCurrentConsent('user-uuid', ConsentType.MARKETING);

      expect(found).toEqual(latestEvent);
      expect(consentRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-uuid', consentType: ConsentType.MARKETING },
        order: { recordedAt: 'DESC' },
      });
    });

    it('returns null when the consent was never granted', async () => {
      await expect(service.findCurrentConsent('user-uuid', ConsentType.CGU)).resolves.toBeNull();
    });
  });

  describe('isConsentGranted', () => {
    it('is true when the last event is a grant', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      );

      await expect(service.isConsentGranted('user-uuid', ConsentType.MARKETING)).resolves.toBe(true);
    });

    it('is false when the last event is a withdrawal, even though grant rows still exist', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.WITHDRAWN, '2026-08-09T10:00:00Z'),
      );

      await expect(service.isConsentGranted('user-uuid', ConsentType.MARKETING)).resolves.toBe(false);
    });

    it('is false when the consent was never granted', async () => {
      await expect(service.isConsentGranted('user-uuid', ConsentType.MARKETING)).resolves.toBe(false);
    });
  });

  describe('listConsentHistory', () => {
    it('returns every event, oldest first', async () => {
      const records = [makeConsentEvent(ConsentType.RGPD, ConsentAction.GRANTED, '2026-08-01T10:00:00Z')];
      consentRepo.find.mockResolvedValue(records);

      await expect(service.listConsentHistory('user-uuid')).resolves.toEqual(records);
      expect(consentRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-uuid' },
        order: { recordedAt: 'ASC' },
      });
    });
  });

  describe('getConsentStates', () => {
    it('returns one state per consent type, even for types never granted', async () => {
      const states = await service.getConsentStates('user-uuid');

      expect(states.map((state) => state.consentType)).toEqual([
        ConsentType.RGPD,
        ConsentType.CGU,
        ConsentType.MARKETING,
      ]);
      expect(states.every((state) => state.isGranted === false)).toBe(true);
      expect(states.every((state) => state.lastEvent === null)).toBe(true);
    });

    it('reads the current state as the last event of each type', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.RGPD, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.WITHDRAWN, '2026-08-09T10:00:00Z'),
      ]);

      const states = await service.getConsentStates('user-uuid');
      const marketingState = states.find((state) => state.consentType === ConsentType.MARKETING)!;
      const rgpdState = states.find((state) => state.consentType === ConsentType.RGPD)!;

      expect(marketingState.isGranted).toBe(false);
      expect(marketingState.lastEvent?.action).toBe(ConsentAction.WITHDRAWN);
      expect(rgpdState.isGranted).toBe(true);
    });

    it('keeps the last grant available after a withdrawal, to prove it was given', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.WITHDRAWN, '2026-08-09T10:00:00Z'),
      ]);

      const states = await service.getConsentStates('user-uuid');
      const marketingState = states.find((state) => state.consentType === ConsentType.MARKETING)!;

      expect(marketingState.lastGrantedEvent?.recordedAt).toEqual(new Date('2026-08-01T10:00:00Z'));
    });

    it('is granted again after a grant → withdraw → grant cycle', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.WITHDRAWN, '2026-08-05T10:00:00Z'),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-09T10:00:00Z'),
      ]);

      const states = await service.getConsentStates('user-uuid');
      const marketingState = states.find((state) => state.consentType === ConsentType.MARKETING)!;

      expect(marketingState.isGranted).toBe(true);
    });
  });

  describe('areMandatoryConsentsGranted', () => {
    it('is true once both rgpd and cgu are granted', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.RGPD, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.CGU, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      ]);

      await expect(service.areMandatoryConsentsGranted('user-uuid')).resolves.toBe(true);
    });

    it('stays true when an optional consent is withdrawn — withdrawing marketing never deactivates an account', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.RGPD, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.CGU, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.WITHDRAWN, '2026-08-09T10:00:00Z'),
      ]);

      await expect(service.areMandatoryConsentsGranted('user-uuid')).resolves.toBe(true);
    });

    it('is false when only one mandatory consent is granted', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.RGPD, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      ]);

      await expect(service.areMandatoryConsentsGranted('user-uuid')).resolves.toBe(false);
    });

    it('is false when only an optional consent is granted', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      ]);

      await expect(service.areMandatoryConsentsGranted('user-uuid')).resolves.toBe(false);
    });

    it('is false when nothing is granted', async () => {
      await expect(service.areMandatoryConsentsGranted('user-uuid')).resolves.toBe(false);
    });
  });
});
