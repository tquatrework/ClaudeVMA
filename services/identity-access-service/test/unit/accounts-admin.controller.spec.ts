import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AccountsAdminController } from '../../src/accounts/accounts-admin.controller';
import { AccountsService } from '../../src/accounts/accounts.service';
import { UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';
import { AccountStatusValue } from '../../src/accounts/dto/update-account-status.dto';
import { makeAuthenticatedUser } from './helpers/authenticated-user.factory';

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
  getAccount: jest.fn(),
  updateRoles: jest.fn(),
  validateAccount: jest.fn(),
  suspendAccount: jest.fn(),
  updateAccountStatus: jest.fn(),
  regenerateAccess: jest.fn(),
  getAuditLogs: jest.fn(),
};

describe('AccountsAdminController', () => {
  let controller: AccountsAdminController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsAdminController],
      providers: [{ provide: AccountsService, useValue: mockAccountsService }],
    }).compile();

    controller = module.get<AccountsAdminController>(AccountsAdminController);
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
    const rpActor = makeAuthenticatedUser({ id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

    it('allows RP to assign animateur_pedagogique role', async () => {
      const updatedAccount = makePublicAccount({ role: UserRole.ANIMATEUR_PEDAGOGIQUE });
      mockAccountsService.updateRoles.mockResolvedValue(updatedAccount);

      const result = await controller.updateRoles(
        'user-uuid',
        { role: UserRole.ANIMATEUR_PEDAGOGIQUE },
        rpActor,
      );

      expect(result.role).toBe(UserRole.ANIMATEUR_PEDAGOGIQUE);
      expect(mockAccountsService.updateRoles).toHaveBeenCalledWith(
        'user-uuid',
        { role: UserRole.ANIMATEUR_PEDAGOGIQUE },
        rpActor,
      );
    });

    it('propagates 403 when actor has insufficient role', async () => {
      mockAccountsService.updateRoles.mockRejectedValue(new ForbiddenException('Only RP or TI can assign internal roles'));
      const eleveActor = makeAuthenticatedUser({ id: 'eleve-uuid', role: UserRole.ELEVE });

      await expect(
        controller.updateRoles('user-uuid', { role: UserRole.ANIMATEUR_PEDAGOGIQUE }, eleveActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propagates 404 when target account does not exist', async () => {
      mockAccountsService.updateRoles.mockRejectedValue(new NotFoundException('Account not found'));

      await expect(
        controller.updateRoles('ghost-uuid', { role: UserRole.ELEVE }, rpActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── PUT /accounts/:accountId/validate ───────────────────────────────────────

  describe('PUT /accounts/:accountId/validate — validateAccount', () => {
    it('validates an account when RP calls the endpoint', async () => {
      const activeAccount = makePublicAccount({ validationStatus: ValidationStatus.ACTIVE });
      mockAccountsService.validateAccount.mockResolvedValue(activeAccount);
      const rpActor = makeAuthenticatedUser({ id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      const result = await controller.validateAccount('user-uuid', rpActor);

      expect(result.validationStatus).toBe(ValidationStatus.ACTIVE);
      expect(mockAccountsService.validateAccount).toHaveBeenCalledWith('user-uuid', rpActor);
    });

    it('propagates 403 when consents are not yet signed (IAM-FB-003)', async () => {
      mockAccountsService.validateAccount.mockRejectedValue(
        new ForbiddenException('Account cannot be validated before mandatory consents are signed (IAM-FB-003)'),
      );
      const rpActor = makeAuthenticatedUser({ id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      await expect(controller.validateAccount('user-uuid', rpActor)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── PUT /accounts/:accountId/suspend ────────────────────────────────────────

  describe('PUT /accounts/:accountId/suspend — suspendAccount', () => {
    it('suspends an account when TI calls the endpoint', async () => {
      const suspendedAccount = makePublicAccount({ validationStatus: ValidationStatus.SUSPENDED, isActive: false });
      mockAccountsService.suspendAccount.mockResolvedValue(suspendedAccount);
      const tiActor = makeAuthenticatedUser({ id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE });

      const result = await controller.suspendAccount('user-uuid', tiActor);

      expect(result.validationStatus).toBe(ValidationStatus.SUSPENDED);
      expect(mockAccountsService.suspendAccount).toHaveBeenCalledWith('user-uuid', tiActor);
    });

    it('propagates 403 when non-TI actor tries to suspend', async () => {
      mockAccountsService.suspendAccount.mockRejectedValue(new ForbiddenException('Only TI can suspend accounts'));
      const rpActor = makeAuthenticatedUser({ id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      await expect(controller.suspendAccount('user-uuid', rpActor)).rejects.toThrow(ForbiddenException);
    });
  });

  // ── PATCH /accounts/:accountId/status ───────────────────────────────────────

  describe('PATCH /accounts/:accountId/status — updateAccountStatus', () => {
    it('sets status to validated when RP calls with validated status and consents signed', async () => {
      const activeAccount = makePublicAccount({ validationStatus: ValidationStatus.ACTIVE });
      mockAccountsService.updateAccountStatus.mockResolvedValue(activeAccount);
      const rpActor = makeAuthenticatedUser({ id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      const result = await controller.updateAccountStatus(
        'user-uuid',
        { status: AccountStatusValue.VALIDATED },
        rpActor,
      );

      expect(result.validationStatus).toBe(ValidationStatus.ACTIVE);
    });

    it('propagates 403 when non-RP/TI tries to change status', async () => {
      mockAccountsService.updateAccountStatus.mockRejectedValue(new ForbiddenException('Only TI or RP can change account status'));
      const eleveActor = makeAuthenticatedUser({ id: 'eleve-uuid', role: UserRole.ELEVE });

      await expect(
        controller.updateAccountStatus('user-uuid', { status: AccountStatusValue.VALIDATED }, eleveActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propagates 403 when RP tries to set suspended status (TI only)', async () => {
      mockAccountsService.updateAccountStatus.mockRejectedValue(new ForbiddenException('Only TI can suspend accounts'));
      const rpActor = makeAuthenticatedUser({ id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      await expect(
        controller.updateAccountStatus('user-uuid', { status: AccountStatusValue.SUSPENDED }, rpActor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows TI to suspend an account via status endpoint', async () => {
      const suspendedAccount = makePublicAccount({ validationStatus: ValidationStatus.SUSPENDED });
      mockAccountsService.updateAccountStatus.mockResolvedValue(suspendedAccount);
      const tiActor = makeAuthenticatedUser({ id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE });

      const result = await controller.updateAccountStatus(
        'user-uuid',
        { status: AccountStatusValue.SUSPENDED },
        tiActor,
      );

      expect(result.validationStatus).toBe(ValidationStatus.SUSPENDED);
    });

    it('propagates 404 when account does not exist', async () => {
      mockAccountsService.updateAccountStatus.mockRejectedValue(new NotFoundException('Account not found'));
      const tiActor = makeAuthenticatedUser({ id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE });

      await expect(
        controller.updateAccountStatus('ghost-uuid', { status: AccountStatusValue.VALIDATED }, tiActor),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── POST /accounts/:accountId/access/regenerate ─────────────────────────────

  describe('POST /accounts/:accountId/access/regenerate — regenerateAccess', () => {
    it('regenerates access for a suspended account when TI calls the endpoint', async () => {
      mockAccountsService.regenerateAccess.mockResolvedValue({
        message: 'Access regenerated for account user-uuid. All existing sessions should be revoked by the client.',
      });
      const tiActor = makeAuthenticatedUser({ id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE });

      const result = await controller.regenerateAccess('user-uuid', tiActor);

      expect(result.message).toContain('Access regenerated');
      expect(mockAccountsService.regenerateAccess).toHaveBeenCalledWith('user-uuid', tiActor);
    });

    it('propagates 403 when non-TI calls regenerateAccess', async () => {
      mockAccountsService.regenerateAccess.mockRejectedValue(
        new ForbiddenException('Only TI can regenerate account access'),
      );
      const rpActor = makeAuthenticatedUser({ id: 'rp-uuid', role: UserRole.RESPONSABLE_PEDAGOGIQUE });

      await expect(controller.regenerateAccess('user-uuid', rpActor)).rejects.toThrow(ForbiddenException);
    });

    it('propagates 404 when target account does not exist', async () => {
      mockAccountsService.regenerateAccess.mockRejectedValue(new NotFoundException('Account not found'));
      const tiActor = makeAuthenticatedUser({ id: 'ti-uuid', role: UserRole.TECHNICIEN_INFORMATIQUE });

      await expect(controller.regenerateAccess('ghost-uuid', tiActor)).rejects.toThrow(NotFoundException);
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
