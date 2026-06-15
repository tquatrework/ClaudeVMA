import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountsController } from '../../src/accounts/accounts.controller';
import { AccountsService } from '../../src/accounts/accounts.service';
import { UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';
import { AccountStatusValue } from '../../src/accounts/dto/update-account-status.dto';

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
  getAccount: jest.fn(),
  updateMe: jest.fn(),
  updateRoles: jest.fn(),
  validateAccount: jest.fn(),
  suspendAccount: jest.fn(),
  updateAccountStatus: jest.fn(),
  regenerateAccess: jest.fn(),
  getAuditLogs: jest.fn(),
};

describe('AccountsController', () => {
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
        controller.createAccount({ email: 'existing@test.com', password: 'password123' }, '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates 403 when self-registering with an internal role', async () => {
      mockAccountsService.createAccount.mockRejectedValue(
        new ForbiddenException('Cannot self-register with an internal role (IAM-FB-002)'),
      );

      await expect(
        controller.createAccount(
          { email: 'hack@test.com', password: 'password123', role: UserRole.TECHNICIEN_INFORMATIQUE },
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
        { email: 'student@test.com', password: 'password123' },
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
        { email: 'student@test.com', password: 'password123', parentEmail: 'parent@test.com', parentPassword: 'parentpass123' },
        '127.0.0.1',
      );

      expect(result.parent).not.toBeNull();
      expect(result.parent!.role).toBe(UserRole.PARENT_FINANCEUR);
    });

    it('propagates 409 when student email is already taken', async () => {
      mockAccountsService.createStudentAccount.mockRejectedValue(new ConflictException('Email already in use'));

      await expect(
        controller.createStudentAccount({ email: 'existing@test.com', password: 'password123' }, '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── POST /accounts/teachers ─────────────────────────────────────────────────

  describe('POST /accounts/teachers — createTeacherAccount', () => {
    it('creates a teacher account with FORMATEUR role and PENDING status', async () => {
      const teacherAccount = makePublicAccount({ role: UserRole.FORMATEUR });
      mockAccountsService.createTeacherAccount.mockResolvedValue(teacherAccount);

      const result = await controller.createTeacherAccount(
        { email: 'teacher@test.com', password: 'password123' },
        '127.0.0.1',
      );

      expect(result.role).toBe(UserRole.FORMATEUR);
      expect(result.validationStatus).toBe(ValidationStatus.PENDING);
    });

    it('propagates 409 when teacher email is already taken', async () => {
      mockAccountsService.createTeacherAccount.mockRejectedValue(new ConflictException('Email already in use'));

      await expect(
        controller.createTeacherAccount({ email: 'existing@test.com', password: 'password123' }, '127.0.0.1'),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── PATCH /accounts/me ──────────────────────────────────────────────────────

  describe('PATCH /accounts/me — updateMe', () => {
    const authenticatedRequest = { user: { id: 'user-uuid', role: UserRole.ELEVE } };

    it('updates email when a valid new email is provided', async () => {
      const updatedAccount = makePublicAccount({ email: 'newemail@example.com' });
      mockAccountsService.updateMe.mockResolvedValue(updatedAccount);

      const result = await controller.updateMe({ email: 'newemail@example.com' }, authenticatedRequest);

      expect(result.email).toBe('newemail@example.com');
      expect(mockAccountsService.updateMe).toHaveBeenCalledWith('user-uuid', { email: 'newemail@example.com' });
    });

    it('updates password without exposing the hash in the response', async () => {
      const updatedAccount = makePublicAccount();
      mockAccountsService.updateMe.mockResolvedValue(updatedAccount);

      const result = await controller.updateMe({ password: 'newPassword123' }, authenticatedRequest);

      expect(result).not.toHaveProperty('passwordHash');
      expect(mockAccountsService.updateMe).toHaveBeenCalledWith('user-uuid', { password: 'newPassword123' });
    });

    it('propagates 409 when the new email is already taken by another account', async () => {
      mockAccountsService.updateMe.mockRejectedValue(new ConflictException('Email already in use'));

      await expect(
        controller.updateMe({ email: 'taken@example.com' }, authenticatedRequest),
      ).rejects.toThrow(ConflictException);
    });

    it('uses the authenticated user id from the JWT, not a URL parameter', async () => {
      const updatedAccount = makePublicAccount();
      mockAccountsService.updateMe.mockResolvedValue(updatedAccount);

      await controller.updateMe({}, authenticatedRequest);

      expect(mockAccountsService.updateMe).toHaveBeenCalledWith('user-uuid', {});
    });
  });

  // ── GET /accounts/:accountId ─────────────────────────────────────────────────

  describe('GET /accounts/:accountId — getAccount', () => {
    it('returns account details for a valid ID', async () => {
      const account = makePublicAccount();
      mockAccountsService.getAccount.mockResolvedValue(account);

      const result = await controller.getAccount('user-uuid');

      expect(result).toEqual(account);
      expect(mockAccountsService.getAccount).toHaveBeenCalledWith('user-uuid');
    });

    it('propagates 404 when account is not found', async () => {
      mockAccountsService.getAccount.mockRejectedValue(new NotFoundException('Account not found'));

      await expect(controller.getAccount('ghost-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /accounts/:accountId/roles ──────────────────────────────────────────

  describe('PUT /accounts/:accountId/roles — updateRoles', () => {
    const rpRequest = { user: { id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };

    it('allows RP to assign animateur_pedagogique role', async () => {
      const updatedAccount = makePublicAccount({ role: UserRole.ANIMATEUR_PEDAGOGIQUE });
      mockAccountsService.updateRoles.mockResolvedValue(updatedAccount);

      const result = await controller.updateRoles(
        'user-uuid',
        { role: UserRole.ANIMATEUR_PEDAGOGIQUE },
        rpRequest,
      );

      expect(result.role).toBe(UserRole.ANIMATEUR_PEDAGOGIQUE);
      expect(mockAccountsService.updateRoles).toHaveBeenCalledWith(
        'user-uuid',
        { role: UserRole.ANIMATEUR_PEDAGOGIQUE },
        rpRequest.user,
      );
    });

    it('propagates 403 when actor has insufficient role', async () => {
      mockAccountsService.updateRoles.mockRejectedValue(new ForbiddenException('Only RP or TI can assign internal roles'));
      const eleveRequest = { user: { id: 'eleve-uuid', role: UserRole.ELEVE } };

      await expect(
        controller.updateRoles('user-uuid', { role: UserRole.ANIMATEUR_PEDAGOGIQUE }, eleveRequest),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propagates 404 when target account does not exist', async () => {
      mockAccountsService.updateRoles.mockRejectedValue(new NotFoundException('Account not found'));

      await expect(
        controller.updateRoles('ghost-uuid', { role: UserRole.ELEVE }, rpRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /accounts/:accountId/validate ───────────────────────────────────────

  describe('PUT /accounts/:accountId/validate — validateAccount', () => {
    it('validates an account when RP calls the endpoint', async () => {
      const activeAccount = makePublicAccount({ validationStatus: ValidationStatus.ACTIVE });
      mockAccountsService.validateAccount.mockResolvedValue(activeAccount);
      const rpRequest = { user: { id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };

      const result = await controller.validateAccount('user-uuid', rpRequest);

      expect(result.validationStatus).toBe(ValidationStatus.ACTIVE);
      expect(mockAccountsService.validateAccount).toHaveBeenCalledWith('user-uuid', rpRequest.user);
    });

    it('propagates 403 when consents are not yet signed (IAM-FB-003)', async () => {
      mockAccountsService.validateAccount.mockRejectedValue(
        new ForbiddenException('Account cannot be validated before mandatory consents are signed (IAM-FB-003)'),
      );
      const rpRequest = { user: { id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };

      await expect(controller.validateAccount('user-uuid', rpRequest)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── PUT /accounts/:accountId/suspend ────────────────────────────────────────

  describe('PUT /accounts/:accountId/suspend — suspendAccount', () => {
    it('suspends an account when TI calls the endpoint', async () => {
      const suspendedAccount = makePublicAccount({ validationStatus: ValidationStatus.SUSPENDED, isActive: false });
      mockAccountsService.suspendAccount.mockResolvedValue(suspendedAccount);
      const tiRequest = { user: { id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE } };

      const result = await controller.suspendAccount('user-uuid', tiRequest);

      expect(result.validationStatus).toBe(ValidationStatus.SUSPENDED);
      expect(mockAccountsService.suspendAccount).toHaveBeenCalledWith('user-uuid', tiRequest.user);
    });

    it('propagates 403 when non-TI actor tries to suspend', async () => {
      mockAccountsService.suspendAccount.mockRejectedValue(new ForbiddenException('Only TI can suspend accounts'));
      const rpRequest = { user: { id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };

      await expect(controller.suspendAccount('user-uuid', rpRequest)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── PATCH /accounts/:accountId/status ───────────────────────────────────────

  describe('PATCH /accounts/:accountId/status — updateAccountStatus', () => {
    it('sets status to validated when RP calls with validated status and consents signed', async () => {
      const activeAccount = makePublicAccount({ validationStatus: ValidationStatus.ACTIVE });
      mockAccountsService.updateAccountStatus.mockResolvedValue(activeAccount);
      const rpRequest = { user: { id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };

      const result = await controller.updateAccountStatus(
        'user-uuid',
        { status: AccountStatusValue.VALIDATED },
        rpRequest,
      );

      expect(result.validationStatus).toBe(ValidationStatus.ACTIVE);
    });

    it('propagates 403 when non-RP/TI tries to change status', async () => {
      mockAccountsService.updateAccountStatus.mockRejectedValue(new ForbiddenException('Only TI or RP can change account status'));
      const eleveRequest = { user: { id: 'eleve-uuid', role: UserRole.ELEVE } };

      await expect(
        controller.updateAccountStatus('user-uuid', { status: AccountStatusValue.VALIDATED }, eleveRequest),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propagates 403 when RP tries to set suspended status (TI only)', async () => {
      mockAccountsService.updateAccountStatus.mockRejectedValue(new ForbiddenException('Only TI can suspend accounts'));
      const rpRequest = { user: { id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };

      await expect(
        controller.updateAccountStatus('user-uuid', { status: AccountStatusValue.SUSPENDED }, rpRequest),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows TI to suspend an account via status endpoint', async () => {
      const suspendedAccount = makePublicAccount({ validationStatus: ValidationStatus.SUSPENDED });
      mockAccountsService.updateAccountStatus.mockResolvedValue(suspendedAccount);
      const tiRequest = { user: { id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE } };

      const result = await controller.updateAccountStatus(
        'user-uuid',
        { status: AccountStatusValue.SUSPENDED },
        tiRequest,
      );

      expect(result.validationStatus).toBe(ValidationStatus.SUSPENDED);
    });

    it('propagates 404 when account does not exist', async () => {
      mockAccountsService.updateAccountStatus.mockRejectedValue(new NotFoundException('Account not found'));
      const tiRequest = { user: { id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE } };

      await expect(
        controller.updateAccountStatus('ghost-uuid', { status: AccountStatusValue.VALIDATED }, tiRequest),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── POST /accounts/:accountId/access/regenerate ─────────────────────────────

  describe('POST /accounts/:accountId/access/regenerate — regenerateAccess', () => {
    it('regenerates access for a suspended account when TI calls the endpoint', async () => {
      mockAccountsService.regenerateAccess.mockResolvedValue({
        message: 'Access regenerated for account user-uuid. All existing sessions should be revoked by the client.',
      });
      const tiRequest = { user: { id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE } };

      const result = await controller.regenerateAccess('user-uuid', tiRequest);

      expect(result.message).toContain('Access regenerated');
      expect(mockAccountsService.regenerateAccess).toHaveBeenCalledWith('user-uuid', tiRequest.user);
    });

    it('propagates 403 when non-TI calls regenerateAccess', async () => {
      mockAccountsService.regenerateAccess.mockRejectedValue(
        new ForbiddenException('Only TI can regenerate account access'),
      );
      const rpRequest = { user: { id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE } };

      await expect(controller.regenerateAccess('user-uuid', rpRequest)).rejects.toThrow(ForbiddenException);
    });

    it('propagates 404 when target account does not exist', async () => {
      mockAccountsService.regenerateAccess.mockRejectedValue(new NotFoundException('Account not found'));
      const tiRequest = { user: { id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE } };

      await expect(controller.regenerateAccess('ghost-uuid', tiRequest)).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /accounts/:accountId/audit ──────────────────────────────────────────

  describe('GET /accounts/:accountId/audit — getAuditLogs', () => {
    it('returns audit log entries for a given account', async () => {
      const auditEntries = [{ id: 'audit-uuid', action: 'ROLE_CHANGED', targetUserId: 'user-uuid' }];
      mockAccountsService.getAuditLogs.mockResolvedValue(auditEntries);

      const result = await controller.getAuditLogs('user-uuid');

      expect(result).toEqual(auditEntries);
      expect(mockAccountsService.getAuditLogs).toHaveBeenCalledWith('user-uuid');
    });
  });
});
