import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException } from '@nestjs/common';
import { ConsentsService } from './consents.service';
import { ConsentRecord, ConsentType } from './entities/consent-record.entity';
import { User, UserRole, ValidationStatus } from '../auth/entities/user.entity';
import { EventsService } from '../events/events.service';

const mockUser: User = {
  id: 'user-uuid',
  email: 'test@test.com',
  passwordHash: 'h',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.PENDING,
  consentSigned: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('ConsentsService', () => {
  let service: ConsentsService;
  let consentRepo: any;
  let userRepo: any;
  let eventsService: EventsService;

  beforeEach(async () => {
    consentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (entity) => ({ id: 'consent-uuid', ...entity })),
    };

    userRepo = {
      findOne: jest.fn().mockResolvedValue({ ...mockUser }),
      save: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentsService,
        { provide: getRepositoryToken(ConsentRecord), useValue: consentRepo },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: EventsService, useValue: { publish: jest.fn() } },
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

    it('activates account after both RGPD and CGU are signed', async () => {
      consentRepo.find.mockResolvedValue([
        { consentType: ConsentType.RGPD },
        { consentType: ConsentType.CGU },
      ]);

      await service.signConsent('user-uuid', { consentType: ConsentType.CGU });

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          consentSigned: true,
          validationStatus: ValidationStatus.ACTIVE,
        }),
      );
    });

    it('does not activate account when only one required consent is present', async () => {
      consentRepo.find.mockResolvedValue([{ consentType: ConsentType.RGPD }]);

      await service.signConsent('user-uuid', { consentType: ConsentType.RGPD });

      expect(userRepo.save).not.toHaveBeenCalled();
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
