import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { User, UserRole, ValidationStatus } from '../auth/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { EventsService } from '../events/events.service';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-uuid',
  email: 'test@example.com',
  passwordHash: 'hash',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.PENDING,
  consentSigned: false,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AccountsService', () => {
  let service: AccountsService;
  let userRepo: any;
  let auditRepo: any;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (user) => ({ id: 'user-uuid', ...user })),
    };

    auditRepo = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: EventsService, useValue: { publish: jest.fn() } },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  describe('createAccount', () => {
    it('creates an account with PENDING status', async () => {
      const result = await service.createAccount({ email: 'new@test.com', password: 'password123' });
      expect(result).toHaveProperty('validationStatus', ValidationStatus.PENDING);
    });

    it('throws 409 when email is already used', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(
        service.createAccount({ email: 'test@example.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 403 when trying to self-register with an internal role (IAM-FB-002)', async () => {
      await expect(
        service.createAccount({
          email: 'hack@test.com',
          password: 'password123',
          role: UserRole.TECHNICIEN_INFORMATIQUE,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows self-registration as formateur', async () => {
      const result = await service.createAccount({
        email: 'teacher@test.com',
        password: 'password123',
        role: UserRole.FORMATEUR,
      });
      expect(result.role).toBe(UserRole.FORMATEUR);
    });
  });

  describe('updateRoles', () => {
    it('allows RP to assign animateur_pedagogique to a formateur (IAM-BR-006)', async () => {
      const target = makeUser({ role: UserRole.FORMATEUR });
      userRepo.findOne.mockResolvedValue(target);
      const actor = makeUser({ id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      const result = await service.updateRoles('user-uuid', { role: UserRole.ANIMATEUR_PEDAGOGIQUE }, actor);
      expect(result.role).toBe(UserRole.ANIMATEUR_PEDAGOGIQUE);
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('throws 403 when non-RP/TI tries to assign internal role', async () => {
      const target = makeUser();
      userRepo.findOne.mockResolvedValue(target);
      const actor = makeUser({ id: 'student-uuid', role: UserRole.ELEVE });

      await expect(
        service.updateRoles('user-uuid', { role: UserRole.ANIMATEUR_PEDAGOGIQUE }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 for unknown account', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const actor = makeUser({ role: UserRole.TECHNICIEN_INFORMATIQUE });
      await expect(
        service.updateRoles('unknown', { role: UserRole.ELEVE }, actor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('validateAccount', () => {
    it('validates an account when consents are signed', async () => {
      const target = makeUser({ consentSigned: true });
      userRepo.findOne.mockResolvedValue(target);
      const actor = makeUser({ id: 'rp', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      const result = await service.validateAccount('user-uuid', actor);
      expect(result.validationStatus).toBe(ValidationStatus.ACTIVE);
    });

    it('throws 403 when consents are not yet signed (IAM-FB-003)', async () => {
      const target = makeUser({ consentSigned: false });
      userRepo.findOne.mockResolvedValue(target);
      const actor = makeUser({ id: 'rp', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      await expect(service.validateAccount('user-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 for non-RP/TI actor', async () => {
      const target = makeUser({ consentSigned: true });
      userRepo.findOne.mockResolvedValue(target);
      const actor = makeUser({ id: 'student', role: UserRole.ELEVE });

      await expect(service.validateAccount('user-uuid', actor)).rejects.toThrow(ForbiddenException);
    });
  });
});
