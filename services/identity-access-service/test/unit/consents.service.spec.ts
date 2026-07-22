import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { ConsentsService } from '../../src/consents/consents.service';
import { ConsentRecord, ConsentType } from '../../src/consents/entities/consent-record.entity';
import { EventsService } from '../../src/events/events.service';
import { AccountsService } from '../../src/accounts/accounts.service';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentsService,
        { provide: getRepositoryToken(ConsentRecord), useValue: consentRepo },
        { provide: EventsService, useValue: { publish: jest.fn() } },
        { provide: AccountsService, useValue: accountsService },
      ],
    }).compile();

    service = module.get<ConsentsService>(ConsentsService);
    eventsService = module.get<EventsService>(EventsService);
  });

  describe('signConsent', () => {
    it('records a new consent and publishes event', async () => {
      const result = await service.signConsent('user-uuid', { consentType: ConsentType.RGPD });
      expect(result.consentType).toBe(ConsentType.RGPD);
      expect(eventsService.publish).toHaveBeenCalledWith('ConsentSigned', expect.any(Object));
    });

    it('throws 409 when consent already signed', async () => {
      consentRepo.findOne.mockResolvedValue({ id: 'existing', consentType: ConsentType.RGPD });
      await expect(
        service.signConsent('user-uuid', { consentType: ConsentType.RGPD }),
      ).rejects.toThrow(ConflictException);
    });

    it('delegates account activation to AccountsService once RGPD and CGU are both signed', async () => {
      consentRepo.find.mockResolvedValue([
        { consentType: ConsentType.RGPD },
        { consentType: ConsentType.CGU },
      ]);

      await service.signConsent('user-uuid', { consentType: ConsentType.CGU });

      expect(accountsService.activateAfterMandatoryConsents).toHaveBeenCalledWith('user-uuid');
    });

    it('does not delegate activation when only one required consent is present', async () => {
      consentRepo.find.mockResolvedValue([{ consentType: ConsentType.RGPD }]);

      await service.signConsent('user-uuid', { consentType: ConsentType.RGPD });

      expect(accountsService.activateAfterMandatoryConsents).not.toHaveBeenCalled();
    });
  });

  describe('getConsents', () => {
    it('returns all consents for a user', async () => {
      const records = [{ id: '1', consentType: ConsentType.RGPD }];
      consentRepo.find.mockResolvedValue(records);
      const result = await service.getConsents('user-uuid');
      expect(result).toEqual(records);
    });
  });
});
