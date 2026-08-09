import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { AccountsController } from '../../src/accounts/accounts.controller';
import { AccountsService } from '../../src/accounts/accounts.service';
import { UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';
import { makeAuthenticatedUser } from './helpers/authenticated-user.factory';
import { LinkedAccountMode } from '../../src/accounts/dto/linked-account-mode';

const makePublicAccount = (overrides = {}) => ({
  id: 'user-uuid',
  email: 'test@example.com',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.PENDING,
  consentSigned: false,
  isActive: true,
  createdAt: new Date(),
  ...overrides,
});

const mockAccountsService = {
  createAccount: jest.fn(),
  createStudentAccount: jest.fn(),
  createTeacherAccount: jest.fn(),
  createParentAccount: jest.fn(),
  updateMe: jest.fn(),
  checkEmail: jest.fn(),
};

describe('AccountsController (self-service)', () => {
  let controller: AccountsController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: mockAccountsService }],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
  });

  // ── POST /accounts ──────────────────────────────────────────────────────────

  describe('POST /accounts — createAccount', () => {
    it('creates an account and returns it in PENDING status', async () => {
      const createdAccount = makePublicAccount();
      mockAccountsService.createAccount.mockResolvedValue(createdAccount);

      const result = await controller.createAccount(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1',
      );

      expect(result).toEqual(createdAccount);
      expect(mockAccountsService.createAccount).toHaveBeenCalledWith(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1',
      );
    });

    it('propagates 409 when email is already used', async () => {
      mockAccountsService.createAccount.mockRejectedValue(new ConflictException('Email already in use'));

      await expect(
        controller.createAccount(
          { email: 'existing@test.com', password: 'password123' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates 403 when self-registering with an internal role', async () => {
      mockAccountsService.createAccount.mockRejectedValue(
        new ForbiddenException('Cannot self-register with an internal role (IAM-FB-002)'),
      );

      await expect(
        controller.createAccount(
          {
            email: 'hack@test.com',
            password: 'password123',
            role: UserRole.TECHNICIEN_INFORMATIQUE,
          },
          '127.0.0.1',
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ── POST /accounts/students ─────────────────────────────────────────────────

  describe('POST /accounts/students — createStudentAccount', () => {
    it('creates a student account without parent', async () => {
      const studentResult = { student: makePublicAccount({ role: UserRole.ELEVE }), parent: null };
      mockAccountsService.createStudentAccount.mockResolvedValue(studentResult);

      const result = await controller.createStudentAccount(
        { email: 'student@test.com', password: 'password123', firstName: 'Lucas', lastName: 'Petit' },
        '127.0.0.1',
      );

      expect(result.student.role).toBe(UserRole.ELEVE);
      expect(result.parent).toBeNull();
    });

    it('creates a student account with an optional linked parent', async () => {
      const studentResult = {
        student: makePublicAccount({ role: UserRole.ELEVE }),
        parent: makePublicAccount({ id: 'parent-uuid', email: 'parent@test.com', role: UserRole.PARENT_FINANCEUR }),
      };
      mockAccountsService.createStudentAccount.mockResolvedValue(studentResult);

      const result = await controller.createStudentAccount(
        {
          email: 'student@test.com',
          password: 'password123',
          firstName: 'Lucas',
          lastName: 'Petit',
          parentAccountMode: LinkedAccountMode.NEW,
          parentLoginIdentifier: 'nathalie.petit',
          parentEmail: 'parent@test.com',
          parentPassword: 'parentpass123',
          parentFirstName: 'Nathalie',
          parentLastName: 'Petit',
        },
        '127.0.0.1',
      );

      expect(result.parent).not.toBeNull();
      expect(result.parent!.role).toBe(UserRole.PARENT_FINANCEUR);
    });

    it('propagates 409 when student email is already taken', async () => {
      mockAccountsService.createStudentAccount.mockRejectedValue(new ConflictException('Email already in use'));

      await expect(
        controller.createStudentAccount(
          { email: 'existing@test.com', password: 'password123', firstName: 'Lucas', lastName: 'Petit' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── POST /accounts/teachers ─────────────────────────────────────────────────

  describe('POST /accounts/teachers — createTeacherAccount', () => {
    it('creates a teacher account with FORMATEUR role and PENDING status', async () => {
      const teacherAccount = makePublicAccount({ role: UserRole.FORMATEUR });
      mockAccountsService.createTeacherAccount.mockResolvedValue(teacherAccount);

      const result = await controller.createTeacherAccount(
        { email: 'teacher@test.com', password: 'password123', firstName: 'Marie', lastName: 'Martin' },
        '127.0.0.1',
      );

      expect(result.role).toBe(UserRole.FORMATEUR);
      expect(result.validationStatus).toBe(ValidationStatus.PENDING);
    });

    it('propagates 409 when teacher email is already taken', async () => {
      mockAccountsService.createTeacherAccount.mockRejectedValue(new ConflictException('Email already in use'));

      await expect(
        controller.createTeacherAccount(
          { email: 'existing@test.com', password: 'password123', firstName: 'Marie', lastName: 'Martin' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── POST /accounts/parents ──────────────────────────────────────────────────

  describe('POST /accounts/parents — createParentAccount', () => {
    it('creates a parent account without a linked student', async () => {
      const parentResult = { parent: makePublicAccount({ role: UserRole.PARENT_FINANCEUR }), student: null };
      mockAccountsService.createParentAccount.mockResolvedValue(parentResult);

      const result = await controller.createParentAccount(
        { email: 'parent@test.com', password: 'password123', firstName: 'Sophie', lastName: 'Bernard' },
        '127.0.0.1',
      );

      expect(result.parent.role).toBe(UserRole.PARENT_FINANCEUR);
      expect(result.student).toBeNull();
    });

    it('creates a parent account with an optional linked student', async () => {
      const parentResult = {
        parent: makePublicAccount({ role: UserRole.PARENT_FINANCEUR }),
        student: makePublicAccount({ id: 'student-uuid', email: 'student@test.com', role: UserRole.ELEVE }),
      };
      mockAccountsService.createParentAccount.mockResolvedValue(parentResult);

      const result = await controller.createParentAccount(
        {
          email: 'parent@test.com',
          password: 'password123',
          firstName: 'Sophie',
          lastName: 'Bernard',
          studentAccountMode: LinkedAccountMode.NEW,
          studentLoginIdentifier: 'lucas.petit',
          studentEmail: 'student@test.com',
          studentPassword: 'studentpass123',
          studentFirstName: 'Lucas',
          studentLastName: 'Petit',
        },
        '127.0.0.1',
      );

      expect(result.student).not.toBeNull();
      expect(result.student!.role).toBe(UserRole.ELEVE);
    });

    it('propagates 409 when parent email is already taken', async () => {
      mockAccountsService.createParentAccount.mockRejectedValue(new ConflictException('Email already in use'));

      await expect(
        controller.createParentAccount(
          { email: 'existing@test.com', password: 'password123', firstName: 'Sophie', lastName: 'Bernard' },
          '127.0.0.1',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── PATCH /accounts/me ──────────────────────────────────────────────────────

  describe('PATCH /accounts/me — updateMe', () => {
    const actor = makeAuthenticatedUser({ id: 'user-uuid', role: UserRole.ELEVE });

    it('updates email when a valid new email is provided', async () => {
      const updatedAccount = makePublicAccount({ email: 'newemail@example.com' });
      mockAccountsService.updateMe.mockResolvedValue(updatedAccount);

      const result = await controller.updateMe({ email: 'newemail@example.com' }, actor);

      expect(result.email).toBe('newemail@example.com');
      expect(mockAccountsService.updateMe).toHaveBeenCalledWith('user-uuid', { email: 'newemail@example.com' });
    });

    it('updates password without exposing the hash in the response', async () => {
      const updatedAccount = makePublicAccount();
      mockAccountsService.updateMe.mockResolvedValue(updatedAccount);

      const result = await controller.updateMe({ password: 'newPassword123' }, actor);

      expect(result).not.toHaveProperty('passwordHash');
      expect(mockAccountsService.updateMe).toHaveBeenCalledWith('user-uuid', { password: 'newPassword123' });
    });

    it('propagates 409 when the new email is already taken by another account', async () => {
      mockAccountsService.updateMe.mockRejectedValue(new ConflictException('Email already in use'));

      await expect(
        controller.updateMe({ email: 'taken@example.com' }, actor),
      ).rejects.toThrow(ConflictException);
    });

    it('uses the authenticated user id from the JWT, not a URL parameter', async () => {
      const updatedAccount = makePublicAccount();
      mockAccountsService.updateMe.mockResolvedValue(updatedAccount);

      await controller.updateMe({}, actor);

      expect(mockAccountsService.updateMe).toHaveBeenCalledWith('user-uuid', {});
    });
  });

  // ── GET /accounts/check-email ────────────────────────────────────────────────

  describe('GET /accounts/check-email — checkEmail', () => {
    it('returns availability and a suggested login identifier', async () => {
      mockAccountsService.checkEmail.mockResolvedValue({ alreadyUsed: true, suggestedLoginIdentifier: 'test.user.2' });

      const result = await controller.checkEmail('test@example.com');

      expect(result).toEqual({ alreadyUsed: true, suggestedLoginIdentifier: 'test.user.2' });
      expect(mockAccountsService.checkEmail).toHaveBeenCalledWith('test@example.com');
    });
  });
});
