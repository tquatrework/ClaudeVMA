import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConsentsService } from '../../src/consents/consents.service';
import { ConsentRecordingService } from '../../src/consents/consent-recording.service';
import {
  ConsentAction,
  ConsentRecord,
  ConsentType,
  DEFAULT_CONSENT_VERSION,
} from '../../src/consents/entities/consent-record.entity';
import { ConsentStatus } from '../../src/consents/dto/consent-state.dto';
import { EventsService } from '../../src/events/events.service';
import { AccountsService } from '../../src/accounts/accounts.service';
import { buildTransactionalDataSourceMock } from './helpers/mock-transactional-data-source';

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

describe('ConsentsService', () => {
  let service: ConsentsService;
  let consentRepo: any;
  let eventsService: EventsService;
  let accountsService: { activateAfterMandatoryConsents: jest.Mock };

  beforeEach(async () => {
    consentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'consent-uuid', ...entity })),
    };

    accountsService = {
      activateAfterMandatoryConsents: jest.fn().mockResolvedValue(undefined),
    };

    const dataSourceMock = buildTransactionalDataSourceMock([[ConsentRecord, consentRepo]]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentsService,
        // ConsentRecordingService est utilisé RÉEL ici : c'est le chemin d'écriture
        // partagé avec les routes de création de compte, il doit être exercé tel quel.
        ConsentRecordingService,
        { provide: getRepositoryToken(ConsentRecord), useValue: consentRepo },
        { provide: EventsService, useValue: { publish: jest.fn() } },
        { provide: AccountsService, useValue: accountsService },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<ConsentsService>(ConsentsService);
    eventsService = module.get<EventsService>(EventsService);
  });

  // ── Octroi ────────────────────────────────────────────────────────────────

  describe('signConsent', () => {
    it('records a new consent and publishes event', async () => {
      const result = await service.signConsent('user-uuid', { consentType: ConsentType.RGPD });
      expect(result.consentType).toBe(ConsentType.RGPD);
      expect(result.action).toBe(ConsentAction.GRANTED);
      expect(eventsService.publish).toHaveBeenCalledWith('ConsentSigned', expect.any(Object));
    });

    it('throws 409 when the consent is currently granted', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.RGPD, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      );

      await expect(
        service.signConsent('user-uuid', { consentType: ConsentType.RGPD }),
      ).rejects.toThrow(ConflictException);
    });

    it('grants again after a withdrawal — the 409 is on the current state, not on the existence of a row', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.WITHDRAWN, '2026-08-09T10:00:00Z'),
      );

      const result = await service.signConsent('user-uuid', { consentType: ConsentType.MARKETING });

      expect(result.action).toBe(ConsentAction.GRANTED);
      expect(eventsService.publish).toHaveBeenCalledWith(
        'ConsentSigned',
        expect.objectContaining({ consentType: ConsentType.MARKETING }),
      );
    });

    it('delegates account activation to AccountsService (same transaction manager) once RGPD and CGU are both granted', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.RGPD, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.CGU, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      ]);

      await service.signConsent('user-uuid', { consentType: ConsentType.CGU });

      expect(accountsService.activateAfterMandatoryConsents).toHaveBeenCalledWith(
        'user-uuid',
        expect.anything(),
      );
    });

    it('does not delegate activation when only one required consent is present', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.RGPD, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      ]);

      await service.signConsent('user-uuid', { consentType: ConsentType.RGPD });

      expect(accountsService.activateAfterMandatoryConsents).not.toHaveBeenCalled();
    });
  });

  // ── Retrait ───────────────────────────────────────────────────────────────

  describe('withdrawConsent', () => {
    it('appends a withdrawal event for an optional consent that is currently granted', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      );

      const result = await service.withdrawConsent(
        'user-uuid',
        ConsentType.MARKETING,
        '203.0.113.7',
      );

      expect(result.action).toBe(ConsentAction.WITHDRAWN);
      expect(consentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-uuid',
          consentType: ConsentType.MARKETING,
          action: ConsentAction.WITHDRAWN,
          ipAddress: '203.0.113.7',
        }),
      );
    });

    it('never deletes nor updates a record — the grant stays provable', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      );
      consentRepo.delete = jest.fn();
      consentRepo.update = jest.fn();
      consentRepo.remove = jest.fn();

      await service.withdrawConsent('user-uuid', ConsentType.MARKETING);

      expect(consentRepo.delete).not.toHaveBeenCalled();
      expect(consentRepo.update).not.toHaveBeenCalled();
      expect(consentRepo.remove).not.toHaveBeenCalled();
      expect(consentRepo.save).toHaveBeenCalledTimes(1);
    });

    it('records the withdrawal against the version that was in force', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z', {
          version: '2.3',
        }),
      );

      const result = await service.withdrawConsent('user-uuid', ConsentType.MARKETING);

      expect(result.version).toBe('2.3');
    });

    it('publishes a ConsentWithdrawn event', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      );

      await service.withdrawConsent('user-uuid', ConsentType.MARKETING);

      expect(eventsService.publish).toHaveBeenCalledWith('ConsentWithdrawn', {
        userId: 'user-uuid',
        consentType: ConsentType.MARKETING,
        version: DEFAULT_CONSENT_VERSION,
      });
    });

    it('never touches the account: withdrawing marketing does not deactivate anything', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      );

      await service.withdrawConsent('user-uuid', ConsentType.MARKETING);

      expect(accountsService.activateAfterMandatoryConsents).not.toHaveBeenCalled();
    });

    it.each([ConsentType.RGPD, ConsentType.CGU])(
      'refuses to withdraw the mandatory consent %s with 403 and points to account closure',
      async (mandatoryConsentType) => {
        consentRepo.findOne.mockResolvedValue(
          makeConsentEvent(mandatoryConsentType, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        );

        await expect(service.withdrawConsent('user-uuid', mandatoryConsentType)).rejects.toThrow(
          ForbiddenException,
        );
        await expect(service.withdrawConsent('user-uuid', mandatoryConsentType)).rejects.toThrow(
          /closing the account/i,
        );
      },
    );

    it('refuses a mandatory consent without writing anything — never absorbed in silence, never a success', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.RGPD, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
      );

      await expect(service.withdrawConsent('user-uuid', ConsentType.RGPD)).rejects.toThrow(
        ForbiddenException,
      );
      expect(consentRepo.save).not.toHaveBeenCalled();
      expect(eventsService.publish).not.toHaveBeenCalled();
    });

    it('throws 404 when the consent was never granted', async () => {
      consentRepo.findOne.mockResolvedValue(null);

      await expect(service.withdrawConsent('user-uuid', ConsentType.MARKETING)).rejects.toThrow(
        NotFoundException,
      );
      expect(consentRepo.save).not.toHaveBeenCalled();
    });

    it('throws 409 on a second withdrawal', async () => {
      consentRepo.findOne.mockResolvedValue(
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.WITHDRAWN, '2026-08-09T10:00:00Z'),
      );

      await expect(service.withdrawConsent('user-uuid', ConsentType.MARKETING)).rejects.toThrow(
        ConflictException,
      );
      expect(consentRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── Lecture ───────────────────────────────────────────────────────────────

  describe('getConsentStates', () => {
    it('returns one entry per consent type, including those never granted', async () => {
      const states = await service.getConsentStates('user-uuid');

      expect(states).toHaveLength(3);
      expect(states.map((state) => state.status)).toEqual([
        ConsentStatus.NEVER_GRANTED,
        ConsentStatus.NEVER_GRANTED,
        ConsentStatus.NEVER_GRANTED,
      ]);
    });

    it('reports a withdrawn consent as withdrawn, never as granted', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.WITHDRAWN, '2026-08-09T10:00:00Z'),
      ]);

      const states = await service.getConsentStates('user-uuid');
      const marketingState = states.find((state) => state.consentType === ConsentType.MARKETING)!;

      expect(marketingState.status).toBe(ConsentStatus.WITHDRAWN);
      expect(marketingState.isGranted).toBe(false);
      expect(marketingState.withdrawnAt).toEqual(new Date('2026-08-09T10:00:00Z'));
      expect(marketingState.grantedAt).toEqual(new Date('2026-08-01T10:00:00Z'));
    });

    it('flags mandatory consents as not withdrawable', async () => {
      const states = await service.getConsentStates('user-uuid');

      expect(states.find((state) => state.consentType === ConsentType.RGPD)!.isWithdrawable).toBe(false);
      expect(states.find((state) => state.consentType === ConsentType.CGU)!.isWithdrawable).toBe(false);
      expect(states.find((state) => state.consentType === ConsentType.MARKETING)!.isWithdrawable).toBe(
        true,
      );
    });

    it('reports a re-granted consent as granted again', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z'),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.WITHDRAWN, '2026-08-05T10:00:00Z'),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-09T10:00:00Z'),
      ]);

      const states = await service.getConsentStates('user-uuid');
      const marketingState = states.find((state) => state.consentType === ConsentType.MARKETING)!;

      expect(marketingState.status).toBe(ConsentStatus.GRANTED);
      expect(marketingState.withdrawnAt).toBeNull();
      expect(marketingState.grantedAt).toEqual(new Date('2026-08-09T10:00:00Z'));
    });
  });

  describe('getConsentHistory', () => {
    it('returns the whole journal, oldest first, without the ip address', async () => {
      consentRepo.find.mockResolvedValue([
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.GRANTED, '2026-08-01T10:00:00Z', {
          ipAddress: '203.0.113.7',
        }),
        makeConsentEvent(ConsentType.MARKETING, ConsentAction.WITHDRAWN, '2026-08-09T10:00:00Z', {
          ipAddress: '203.0.113.7',
        }),
      ]);

      const history = await service.getConsentHistory('user-uuid');

      expect(history.map((event) => event.action)).toEqual([
        ConsentAction.GRANTED,
        ConsentAction.WITHDRAWN,
      ]);
      expect(history.every((event) => !('ipAddress' in event))).toBe(true);
    });

    it('returns an empty journal for an account that never consented to anything', async () => {
      await expect(service.getConsentHistory('user-uuid')).resolves.toEqual([]);
    });
  });
});
