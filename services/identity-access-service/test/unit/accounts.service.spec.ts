import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountsService } from '../../src/accounts/accounts.service';
import { User, UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';
import { AuditLog } from '../../src/accounts/entities/audit-log.entity';
import { EventsService } from '../../src/events/events.service';
import { ProfileServiceClient } from '../../src/common/clients/profile-service.client';
import { buildTransactionalDataSourceMock } from './helpers/mock-transactional-data-source';

const makeUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-uuid',
  loginIdentifier: 'test.user',
  email: 'test@example.com',
  passwordHash: 'hash',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.PENDING,
  consentSigned: false,
  isActive: true,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AccountsService', () => {
  let service: AccountsService;
  let userRepo: any;
  let auditRepo: any;
  let eventsService: { publish: jest.Mock };
  let profileServiceClient: { createAdministrativeProfile: jest.Mock; linkParentToStudent: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockImplementation(async (user) => ({ id: 'user-uuid', ...user })),
      update: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn().mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };

    auditRepo = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
    };

    eventsService = { publish: jest.fn() };
    profileServiceClient = {
      createAdministrativeProfile: jest.fn().mockResolvedValue(undefined),
      linkParentToStudent: jest.fn().mockResolvedValue(undefined),
    };

    const dataSourceMock = buildTransactionalDataSourceMock([
      [User, userRepo],
      [AuditLog, auditRepo],
    ]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
        { provide: EventsService, useValue: eventsService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, defaultValue?: unknown) => defaultValue ?? null) },
        },
        { provide: ProfileServiceClient, useValue: profileServiceClient },
        { provide: DataSource, useValue: dataSourceMock },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  describe('createAccount', () => {
    it('creates an account with PENDING status', async () => {
      const result = await service.createAccount({
        email: 'new@test.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
      });
      expect(result).toHaveProperty('validationStatus', ValidationStatus.PENDING);
      expect(result).toHaveProperty('loginIdentifier');
    });

    it('does not expose firstName/lastName on the response (identity-access-service no longer owns these fields)', async () => {
      const result = await service.createAccount({
        email: 'named@test.com',
        password: 'password123',
        firstName: 'Camille',
        lastName: 'Lefevre',
      });
      expect(result).not.toHaveProperty('firstName');
      expect(result).not.toHaveProperty('lastName');
    });

    it('creates account even when email is already used, setting emailAlreadyUsed flag', async () => {
      // First findOne call (loginIdentifier check) returns null, second (email check) returns existing user
      userRepo.findOne
        .mockResolvedValueOnce(null)   // loginIdentifier availability check
        .mockResolvedValueOnce(makeUser()); // email already used check
      const result = await service.createAccount({
        email: 'test@example.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
      });
      expect(result).toHaveProperty('emailAlreadyUsed', true);
      expect(result).toHaveProperty('suggestedLoginIdentifier');
    });

    it('throws 409 when requested loginIdentifier is already taken', async () => {
      userRepo.findOne.mockResolvedValue(makeUser()); // loginIdentifier taken
      await expect(
        service.createAccount({
          email: 'new@test.com',
          password: 'password123',
          firstName: 'Jean',
          lastName: 'Dupont',
          loginIdentifier: 'test.user',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 403 when trying to self-register with an internal role (IAM-FB-002)', async () => {
      await expect(
        service.createAccount({
          email: 'hack@test.com',
          password: 'password123',
          firstName: 'Jean',
          lastName: 'Dupont',
          role: UserRole.TECHNICIEN_INFORMATIQUE,
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows self-registration as formateur', async () => {
      const result = await service.createAccount({
        email: 'teacher@test.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        role: UserRole.FORMATEUR,
      });
      expect(result.role).toBe(UserRole.FORMATEUR);
    });

    it('publishes AccountCreated with userId, email, loginIdentifier and role after account creation', async () => {
      await service.createAccount({
        email: 'new@test.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
      });
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
      const result = await service.createStudentAccount({
        email: 'student@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
      });
      expect(result.student).toHaveProperty('validationStatus', ValidationStatus.PENDING);
      expect(result.student.role).toBe(UserRole.ELEVE);
      expect(result.parent).toBeNull();
    });

    it('does not expose firstName/lastName on the student response', async () => {
      const result = await service.createStudentAccount({
        email: 'student2@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
      });
      expect(result.student).not.toHaveProperty('firstName');
      expect(result.student).not.toHaveProperty('lastName');
    });

    it('creates a parent account when parentEmail is provided and no existing parent matches', async () => {
      // findOne returns null for each loginIdentifier check and email dedup check
      // find (for parentEmail lookup) returns empty array → create new parent
      userRepo.find = jest.fn().mockResolvedValue([]);
      const result = await service.createStudentAccount({
        email: 'student@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: 'parent@test.com',
        parentPassword: 'parentpass123',
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      });
      expect(result.student.role).toBe(UserRole.ELEVE);
      expect(result.parent).not.toBeNull();
      expect(result.parent!.role).toBe(UserRole.PARENT_FINANCEUR);
      expect(result.parent).not.toHaveProperty('firstName');
      expect(result.parent).not.toHaveProperty('lastName');
    });

    it('links existing parent account when exactly one account matches parentEmail', async () => {
      const existingParent = makeUser({ id: 'parent-uuid', loginIdentifier: 'parent.user', email: 'parent@test.com', role: UserRole.PARENT_FINANCEUR });
      userRepo.find = jest.fn().mockResolvedValue([existingParent]);
      const result = await service.createStudentAccount({
        email: 'student@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: 'parent@test.com',
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      });
      expect(result.parent!.id).toBe('parent-uuid');
      expect(result.parent!.created).toBe(false);
    });

    it('throws 409 when multiple accounts share the parentEmail', async () => {
      const parentA = makeUser({ id: 'pa-uuid', loginIdentifier: 'parent.a' });
      const parentB = makeUser({ id: 'pb-uuid', loginIdentifier: 'parent.b' });
      userRepo.find = jest.fn().mockResolvedValue([parentA, parentB]);
      await expect(
        service.createStudentAccount({
          email: 'student@test.com',
          password: 'password123',
          firstName: 'Lucas',
          lastName: 'Petit',
          parentEmail: 'shared@test.com',
          parentFirstName: 'Nathalie',
          parentLastName: 'Petit',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 409 when requested loginIdentifier is already taken', async () => {
      userRepo.findOne.mockResolvedValue(makeUser()); // loginIdentifier taken
      await expect(
        service.createStudentAccount({
          email: 'new@test.com',
          password: 'password123',
          firstName: 'Lucas',
          lastName: 'Petit',
          loginIdentifier: 'test.user',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('publishes AccountCreated for the student with userId and role ELEVE', async () => {
      await service.createStudentAccount({
        email: 'student@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
      });
      expect(eventsService.publish).toHaveBeenCalledWith('AccountCreated', expect.objectContaining({
        userId: 'user-uuid',
        email: 'student@test.com',
        role: UserRole.ELEVE,
      }));
    });

    it('publishes AccountCreated for both student and parent when parentEmail triggers new account creation', async () => {
      userRepo.find = jest.fn().mockResolvedValue([]);
      await service.createStudentAccount({
        email: 'student@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: 'parent@test.com',
        parentPassword: 'parentpass123',
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
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
      const result = await service.createTeacherAccount({
        email: 'teacher@test.com',
        password: 'password123',
        firstName: 'Marie',
        lastName: 'Martin',
      });
      expect(result.role).toBe(UserRole.FORMATEUR);
      expect(result.validationStatus).toBe(ValidationStatus.PENDING);
      expect(result).toHaveProperty('loginIdentifier');
    });

    it('does not expose firstName/lastName on the response', async () => {
      const result = await service.createTeacherAccount({
        email: 'teacher2@test.com',
        password: 'password123',
        firstName: 'Marie',
        lastName: 'Martin',
      });
      expect(result).not.toHaveProperty('firstName');
      expect(result).not.toHaveProperty('lastName');
    });

    it('creates account even when email is already used, setting emailAlreadyUsed flag', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(null)   // loginIdentifier availability check
        .mockResolvedValueOnce(makeUser()); // email already used check
      const result = await service.createTeacherAccount({
        email: 'existing@test.com',
        password: 'password123',
        firstName: 'Marie',
        lastName: 'Martin',
      });
      expect(result).toHaveProperty('emailAlreadyUsed', true);
    });

    it('throws 409 when requested loginIdentifier is already taken', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(
        service.createTeacherAccount({
          email: 'new@test.com',
          password: 'password123',
          firstName: 'Marie',
          lastName: 'Martin',
          loginIdentifier: 'test.user',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('publishes AccountCreated with userId, loginIdentifier and role FORMATEUR after teacher account creation', async () => {
      await service.createTeacherAccount({
        email: 'teacher@test.com',
        password: 'password123',
        firstName: 'Marie',
        lastName: 'Martin',
      });
      expect(eventsService.publish).toHaveBeenCalledWith('AccountCreated', expect.objectContaining({
        userId: 'user-uuid',
        email: 'teacher@test.com',
        role: UserRole.FORMATEUR,
      }));
    });
  });

  describe('createParentAccount', () => {
    it('creates a parent account with PENDING status and does not expose firstName/lastName', async () => {
      const result = await service.createParentAccount({
        email: 'parent@test.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
      });
      expect(result.parent.role).toBe(UserRole.PARENT_FINANCEUR);
      expect(result.parent.validationStatus).toBe(ValidationStatus.PENDING);
      expect(result.parent).not.toHaveProperty('firstName');
      expect(result.parent).not.toHaveProperty('lastName');
      expect(result.student).toBeNull();
    });

    it('publishes AccountCreated with userId and role PARENT_FINANCEUR', async () => {
      await service.createParentAccount({
        email: 'parent@test.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
      });
      expect(eventsService.publish).toHaveBeenCalledWith('AccountCreated', expect.objectContaining({
        userId: 'user-uuid',
        email: 'parent@test.com',
        role: UserRole.PARENT_FINANCEUR,
      }));
    });

    it('creates a student account when studentEmail is provided and no existing student matches', async () => {
      userRepo.find = jest.fn().mockResolvedValue([]);
      const result = await service.createParentAccount({
        email: 'parent@test.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentEmail: 'student@test.com',
        studentPassword: 'studentpass123',
        studentFirstName: 'Lucas',
        studentLastName: 'Petit',
      });
      expect(result.parent.role).toBe(UserRole.PARENT_FINANCEUR);
      expect(result.student).not.toBeNull();
      expect(result.student!.role).toBe(UserRole.ELEVE);
      expect(result.student!.created).toBe(true);
    });

    it('links existing student account when exactly one account matches studentEmail', async () => {
      const existingStudent = makeUser({ id: 'student-uuid', loginIdentifier: 'student.user', email: 'student@test.com', role: UserRole.ELEVE });
      userRepo.find = jest.fn().mockResolvedValue([existingStudent]);
      const result = await service.createParentAccount({
        email: 'parent@test.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentEmail: 'student@test.com',
      });
      expect(result.student!.id).toBe('student-uuid');
      expect(result.student!.created).toBe(false);
    });

    it('throws 409 when multiple accounts share the studentEmail', async () => {
      const studentA = makeUser({ id: 'sa-uuid', loginIdentifier: 'student.a' });
      const studentB = makeUser({ id: 'sb-uuid', loginIdentifier: 'student.b' });
      userRepo.find = jest.fn().mockResolvedValue([studentA, studentB]);
      await expect(
        service.createParentAccount({
          email: 'parent@test.com',
          password: 'password123',
          firstName: 'Sophie',
          lastName: 'Bernard',
          studentEmail: 'shared@test.com',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws 404 when studentLoginIdentifier does not match any account', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createParentAccount({
          email: 'parent@test.com',
          password: 'password123',
          firstName: 'Sophie',
          lastName: 'Bernard',
          studentLoginIdentifier: 'unknown.student',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('calls profile-service to link the parent as finance owner when a student is linked or created in the same call', async () => {
      userRepo.find = jest.fn().mockResolvedValue([]);
      await service.createParentAccount({
        email: 'parent@test.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
        studentEmail: 'student@test.com',
        studentPassword: 'studentpass123',
        studentFirstName: 'Lucas',
        studentLastName: 'Petit',
      });
      expect(profileServiceClient.linkParentToStudent).toHaveBeenCalledWith({
        studentId: 'user-uuid',
        financeOwnerId: 'user-uuid',
      });
    });

    it('does not call link-parent when no student is involved', async () => {
      await service.createParentAccount({
        email: 'parent@test.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
      });
      expect(profileServiceClient.linkParentToStudent).not.toHaveBeenCalled();
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

  describe('findByUserId', () => {
    it('returns userId, loginIdentifier and role without firstName/lastName', async () => {
      const target = makeUser();
      userRepo.findOne.mockResolvedValue(target);

      const result = await service.findByUserId('user-uuid');

      expect(result).toEqual({
        userId: 'user-uuid',
        loginIdentifier: target.loginIdentifier,
        role: target.role,
      });
    });

    it('throws 404 when no account matches the userId', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.findByUserId('ghost-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── Ports exposés aux autres features (modules-convention) ──────────────────

  describe('findCredentialsByLoginIdentifier', () => {
    it('returns the user including the password hash', async () => {
      const target = makeUser();
      userRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(target),
      });

      const result = await service.findCredentialsByLoginIdentifier('test.user');
      expect(result).toEqual(target);
    });

    it('returns null when no account matches the login identifier', async () => {
      const result = await service.findCredentialsByLoginIdentifier('unknown.user');
      expect(result).toBeNull();
    });
  });

  describe('findActiveAccountById', () => {
    it('returns the account when found', async () => {
      const target = makeUser();
      userRepo.findOne.mockResolvedValue(target);
      const result = await service.findActiveAccountById('user-uuid');
      expect(result).toEqual(target);
    });

    it('returns null when the account does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.findActiveAccountById('ghost-uuid');
      expect(result).toBeNull();
    });
  });

  describe('findAccountByEmail / findAccountsByEmail', () => {
    it('returns a single account matching the email', async () => {
      const target = makeUser();
      userRepo.findOne.mockResolvedValue(target);
      const result = await service.findAccountByEmail('test@example.com');
      expect(result).toEqual(target);
    });

    it('returns an empty array when no account matches the email', async () => {
      userRepo.find.mockResolvedValue([]);
      const result = await service.findAccountsByEmail('unknown@example.com');
      expect(result).toEqual([]);
    });
  });

  describe('markEmailVerified', () => {
    it('updates emailVerified to true for the given user', async () => {
      await service.markEmailVerified('user-uuid');
      expect(userRepo.update).toHaveBeenCalledWith('user-uuid', { emailVerified: true });
    });
  });

  describe('updatePasswordHash', () => {
    it('updates the password hash for the given user', async () => {
      await service.updatePasswordHash('user-uuid', 'new-hash');
      expect(userRepo.update).toHaveBeenCalledWith('user-uuid', { passwordHash: 'new-hash' });
    });
  });

  describe('activateAfterMandatoryConsents', () => {
    it('activates a pending account and marks consentSigned', async () => {
      const target = makeUser({ consentSigned: false, validationStatus: ValidationStatus.PENDING });
      userRepo.findOne.mockResolvedValue(target);

      await service.activateAfterMandatoryConsents('user-uuid');

      expect(userRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ consentSigned: true, validationStatus: ValidationStatus.ACTIVE }),
      );
    });

    it('does nothing when the account is already marked as consentSigned', async () => {
      const target = makeUser({ consentSigned: true });
      userRepo.findOne.mockResolvedValue(target);

      await service.activateAfterMandatoryConsents('user-uuid');

      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('does nothing when the account does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await service.activateAfterMandatoryConsents('ghost-uuid');

      expect(userRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('accountExists', () => {
    it('returns true when at least one account matches the id', async () => {
      userRepo.count.mockResolvedValue(1);
      await expect(service.accountExists('user-uuid')).resolves.toBe(true);
    });

    it('returns false when no account matches the id', async () => {
      userRepo.count.mockResolvedValue(0);
      await expect(service.accountExists('ghost-uuid')).resolves.toBe(false);
    });
  });

  describe('recordAudit', () => {
    it('persists an audit entry via the AuditLog repository owned by this module', async () => {
      await service.recordAudit({
        targetUserId: 'target-uuid',
        actorId: 'actor-uuid',
        action: 'DELEGATION_CREATED',
        oldValue: null,
        newValue: { foo: 'bar' },
      });

      expect(auditRepo.save).toHaveBeenCalled();
    });
  });

  // ── Stockage du profil administratif via profile-service (décision du 2026-08-05) ──

  describe('administrative profile storage via profile-service', () => {
    it('createAccount: calls profile-service with {userId, firstName, lastName} after creating the account', async () => {
      await service.createAccount({
        email: 'store@test.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
      });

      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledWith({
        userId: 'user-uuid',
        firstName: 'Jean',
        lastName: 'Dupont',
      });
    });

    it('createAccount: forwards phoneNumber to profile-service when provided', async () => {
      await service.createAccount({
        email: 'store-phone@test.com',
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
        phoneNumber: '+33 6 01 02 03 04',
      });

      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledWith({
        userId: 'user-uuid',
        firstName: 'Jean',
        lastName: 'Dupont',
        phoneNumber: '+33 6 01 02 03 04',
      });
    });

    it('createAccount: fails the account creation with 503 when profile-service is unavailable, and no account is left behind', async () => {
      profileServiceClient.createAdministrativeProfile.mockRejectedValueOnce(
        new Error('profile-service unreachable or timed out'),
      );

      await expect(
        service.createAccount({
          email: 'resilient@test.com',
          password: 'password123',
          firstName: 'Jean',
          lastName: 'Dupont',
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalled();
      // AccountCreated must not be published for a rolled-back account.
      expect(eventsService.publish).not.toHaveBeenCalled();
    });

    it('createTeacherAccount: calls profile-service with the teacher userId/firstName/lastName', async () => {
      await service.createTeacherAccount({
        email: 'teacher-store@test.com',
        password: 'password123',
        firstName: 'Marie',
        lastName: 'Martin',
      });

      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledWith({
        userId: 'user-uuid',
        firstName: 'Marie',
        lastName: 'Martin',
      });
    });

    it('createTeacherAccount: fails with 503 when profile-service is unavailable', async () => {
      profileServiceClient.createAdministrativeProfile.mockRejectedValueOnce(new Error('timeout'));

      await expect(
        service.createTeacherAccount({
          email: 'teacher-fail@test.com',
          password: 'password123',
          firstName: 'Marie',
          lastName: 'Martin',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('createParentAccount: calls profile-service with the parent userId/firstName/lastName', async () => {
      await service.createParentAccount({
        email: 'parent-store@test.com',
        password: 'password123',
        firstName: 'Sophie',
        lastName: 'Bernard',
      });

      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledWith({
        userId: 'user-uuid',
        firstName: 'Sophie',
        lastName: 'Bernard',
      });
    });

    it('createParentAccount: fails with 503 when profile-service is unavailable', async () => {
      profileServiceClient.createAdministrativeProfile.mockRejectedValueOnce(new Error('timeout'));

      await expect(
        service.createParentAccount({
          email: 'parent-fail@test.com',
          password: 'password123',
          firstName: 'Sophie',
          lastName: 'Bernard',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it('createStudentAccount: calls profile-service for the student, and for the parent when parentEmail triggers creation', async () => {
      userRepo.find = jest.fn().mockResolvedValue([]); // no existing parent → parent created
      await service.createStudentAccount({
        email: 'student-store@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: 'parent-store@test.com',
        parentPassword: 'parentpass123',
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      });

      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Lucas', lastName: 'Petit' }),
      );
      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Nathalie', lastName: 'Petit' }),
      );
      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledTimes(2);
    });

    it('createStudentAccount: calls profile-service only for the student when no parent is involved', async () => {
      await service.createStudentAccount({
        email: 'student-only@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
      });

      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledTimes(1);
      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Lucas', lastName: 'Petit' }),
      );
    });

    it('createStudentAccount: does not call profile-service for an existing linked parent (their profile is not overwritten)', async () => {
      const existingParent = makeUser({ id: 'parent-uuid', loginIdentifier: 'parent.user', email: 'parent@test.com', role: UserRole.PARENT_FINANCEUR });
      userRepo.find = jest.fn().mockResolvedValue([existingParent]);

      await service.createStudentAccount({
        email: 'student-linked@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: 'parent@test.com',
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      });

      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledTimes(1);
      expect(profileServiceClient.createAdministrativeProfile).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Lucas', lastName: 'Petit' }),
      );
    });

    it('createStudentAccount: fails with 503 and rolls back both accounts when profile-service is unavailable for the parent', async () => {
      userRepo.find = jest.fn().mockResolvedValue([]);
      profileServiceClient.createAdministrativeProfile
        .mockResolvedValueOnce(undefined) // student profile succeeds
        .mockRejectedValueOnce(new Error('timeout')); // parent profile fails

      await expect(
        service.createStudentAccount({
          email: 'student-rollback@test.com',
          password: 'password123',
          firstName: 'Lucas',
          lastName: 'Petit',
          parentEmail: 'parent-rollback@test.com',
          parentPassword: 'parentpass123',
          parentFirstName: 'Nathalie',
          parentLastName: 'Petit',
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(eventsService.publish).not.toHaveBeenCalled();
    });
  });

  // ── Liaison financeur/élève automatique (décision produit du 2026-08-05) ──

  describe('automatic finance-owner-student link', () => {
    it('createStudentAccount: calls profile-service to link the student to the newly created parent', async () => {
      userRepo.find = jest.fn().mockResolvedValue([]);
      await service.createStudentAccount({
        email: 'student-link@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: 'parent-link@test.com',
        parentPassword: 'parentpass123',
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      });

      expect(profileServiceClient.linkParentToStudent).toHaveBeenCalledWith({
        studentId: 'user-uuid',
        financeOwnerId: 'user-uuid',
      });
    });

    it('createStudentAccount: also links when the parent is an existing linked account (not newly created)', async () => {
      const existingParent = makeUser({ id: 'parent-uuid', loginIdentifier: 'parent.user', email: 'parent@test.com', role: UserRole.PARENT_FINANCEUR });
      userRepo.find = jest.fn().mockResolvedValue([existingParent]);

      await service.createStudentAccount({
        email: 'student-link2@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
        parentEmail: 'parent@test.com',
        parentFirstName: 'Nathalie',
        parentLastName: 'Petit',
      });

      expect(profileServiceClient.linkParentToStudent).toHaveBeenCalledWith({
        studentId: 'user-uuid',
        financeOwnerId: 'parent-uuid',
      });
    });

    it('createStudentAccount: does not call link-parent when no parent is involved', async () => {
      await service.createStudentAccount({
        email: 'student-nolink@test.com',
        password: 'password123',
        firstName: 'Lucas',
        lastName: 'Petit',
      });

      expect(profileServiceClient.linkParentToStudent).not.toHaveBeenCalled();
    });

    it('createStudentAccount: fails with 503 and rolls back both accounts when the link call fails', async () => {
      userRepo.find = jest.fn().mockResolvedValue([]);
      profileServiceClient.linkParentToStudent.mockRejectedValueOnce(new Error('timeout'));

      await expect(
        service.createStudentAccount({
          email: 'student-linkfail@test.com',
          password: 'password123',
          firstName: 'Lucas',
          lastName: 'Petit',
          parentEmail: 'parent-linkfail@test.com',
          parentPassword: 'parentpass123',
          parentFirstName: 'Nathalie',
          parentLastName: 'Petit',
        }),
      ).rejects.toThrow(ServiceUnavailableException);

      expect(eventsService.publish).not.toHaveBeenCalled();
    });
  });
});
