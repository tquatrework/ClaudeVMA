import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountsService } from '../../src/accounts/accounts.service';
import { User, UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';
import { AuditLog } from '../../src/accounts/entities/audit-log.entity';
import { EventsService } from '../../src/events/events.service';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-uuid',
  email: 'test@example.com',
  passwordHash: 'hash',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.PENDING,
  consentSigned: false,
  firstName: null,
  lastName: null,
  phone: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AccountsService', () => {
  let service: AccountsService;
  let userRepo: any;
  let auditRepo: any;
  let eventsService: { publish: jest.Mock };

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

    eventsService = { publish: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: EventsService, useValue: eventsService },
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

    it('publishes AccountCreated with userId, email and role after account creation', async () => {
      await service.createAccount({ email: 'new@test.com', password: 'password123' });
      expect(eventsService.publish).toHaveBeenCalledWith('AccountCreated', expect.objectContaining({
        userId: 'user-uuid',
        email: 'new@test.com',
        role: UserRole.ELEVE,
      }));
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

  describe('createStudentAccount', () => {
    it('creates a student account with PENDING status', async () => {
      const result = await service.createStudentAccount({ email: 'student@test.com', password: 'password123' });
      expect(result.student).toHaveProperty('validationStatus', ValidationStatus.PENDING);
      expect(result.student.role).toBe(UserRole.ELEVE);
      expect(result.parent).toBeNull();
    });

    it('creates a parent account when parentEmail is provided', async () => {
      const result = await service.createStudentAccount({
        email: 'student@test.com',
        password: 'password123',
        parentEmail: 'parent@test.com',
        parentPassword: 'parentpass123',
      });
      expect(result.student.role).toBe(UserRole.ELEVE);
      expect(result.parent).not.toBeNull();
      expect(result.parent!.role).toBe(UserRole.PARENT_FINANCEUR);
    });

    it('throws 409 when student email is already used', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(
        service.createStudentAccount({ email: 'existing@test.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('publishes AccountCreated for the student with userId and role ELEVE', async () => {
      await service.createStudentAccount({ email: 'student@test.com', password: 'password123' });
      expect(eventsService.publish).toHaveBeenCalledWith('AccountCreated', expect.objectContaining({
        userId: 'user-uuid',
        email: 'student@test.com',
        role: UserRole.ELEVE,
      }));
    });

    it('publishes AccountCreated for both student and parent when parentEmail is provided', async () => {
      await service.createStudentAccount({
        email: 'student@test.com',
        password: 'password123',
        parentEmail: 'parent@test.com',
        parentPassword: 'parentpass123',
      });
      const publishCalls = eventsService.publish.mock.calls.filter(
        ([eventType]) => eventType === 'AccountCreated',
      );
      expect(publishCalls).toHaveLength(2);
      const publishedRoles = publishCalls.map(([, payload]) => payload.role);
      expect(publishedRoles).toContain(UserRole.ELEVE);
      expect(publishedRoles).toContain(UserRole.PARENT_FINANCEUR);
      publishCalls.forEach(([, payload]) => {
        expect(payload).toHaveProperty('userId');
        expect(typeof payload.userId).toBe('string');
      });
    });
  });

  describe('createTeacherAccount', () => {
    it('creates a teacher account with PENDING status and FORMATEUR role', async () => {
      const result = await service.createTeacherAccount({ email: 'teacher@test.com', password: 'password123' });
      expect(result.role).toBe(UserRole.FORMATEUR);
      expect(result.validationStatus).toBe(ValidationStatus.PENDING);
    });

    it('throws 409 when email is already used', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(
        service.createTeacherAccount({ email: 'existing@test.com', password: 'password123' }),
      ).rejects.toThrow(ConflictException);
    });

    it('publishes AccountCreated with userId and role FORMATEUR after teacher account creation', async () => {
      await service.createTeacherAccount({ email: 'teacher@test.com', password: 'password123' });
      expect(eventsService.publish).toHaveBeenCalledWith('AccountCreated', expect.objectContaining({
        userId: 'user-uuid',
        email: 'teacher@test.com',
        role: UserRole.FORMATEUR,
      }));
    });
  });

  describe('updateAccountStatus', () => {
    it('validates account when RP sets status to validated with consents signed', async () => {
      const target = makeUser({ consentSigned: true });
      userRepo.findOne.mockResolvedValue(target);
      const actor = makeUser({ id: 'rp', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      const result = await service.updateAccountStatus('user-uuid', { status: 'validated' as any }, actor);
      expect(result.validationStatus).toBe(ValidationStatus.ACTIVE);
    });

    it('throws 403 when non-RP/TI tries to change status', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const actor = makeUser({ role: UserRole.ELEVE });
      await expect(
        service.updateAccountStatus('user-uuid', { status: 'validated' as any }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws 403 when non-TI tries to suspend an account', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const actor = makeUser({ id: 'rp', role: UserRole.RESPONSABLE_PEDAGOGIQUE });
      await expect(
        service.updateAccountStatus('user-uuid', { status: 'suspended' as any }, actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows TI to suspend an account', async () => {
      const target = makeUser();
      userRepo.findOne.mockResolvedValue(target);
      const actor = makeUser({ id: 'ti', role: UserRole.TECHNICIEN_INFORMATIQUE });

      const result = await service.updateAccountStatus('user-uuid', { status: 'suspended' as any }, actor);
      expect(result.validationStatus).toBe(ValidationStatus.SUSPENDED);
    });
  });

  describe('regenerateAccess', () => {
    it('reactivates account when TI calls regenerate', async () => {
      const target = makeUser({ isActive: false, validationStatus: ValidationStatus.SUSPENDED });
      userRepo.findOne.mockResolvedValue(target);
      const actor = makeUser({ id: 'ti', role: UserRole.TECHNICIEN_INFORMATIQUE });

      const result = await service.regenerateAccess('user-uuid', actor);
      expect(result.message).toContain('Access regenerated');
    });

    it('throws 403 when non-TI calls regenerate', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const actor = makeUser({ role: UserRole.RESPONSABLE_PEDAGOGIQUE });
      await expect(service.regenerateAccess('user-uuid', actor)).rejects.toThrow(ForbiddenException);
    });

    it('throws 404 when account does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const actor = makeUser({ role: UserRole.TECHNICIEN_INFORMATIQUE });
      await expect(service.regenerateAccess('ghost-uuid', actor)).rejects.toThrow(NotFoundException);
    });
  });
});
