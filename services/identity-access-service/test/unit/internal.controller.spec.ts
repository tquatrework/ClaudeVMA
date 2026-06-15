import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate } from '@nestjs/common';
import { InternalController } from '../../src/internal/internal.controller';
import { AccountsService } from '../../src/accounts/accounts.service';
import { InternalGuard } from '../../src/internal/internal.guard';
import { UserRole } from '../../src/auth/entities/user.entity';

const buildAccountSummary = (overrides: Partial<{
  userId: string;
  role: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
}> = {}) => ({
  userId: '87482274-1ef2-412a-827b-75fc48c28370',
  role: UserRole.ELEVE,
  email: 'eleve@example.com',
  firstName: null,
  lastName: null,
  phone: null,
  ...overrides,
});

/** Guard simulé qui autorise toujours (contourne ConfigService en test unitaire) */
const internalGuardAlwaysAllow: CanActivate = { canActivate: () => true };

describe('InternalController — GET /internal/accounts', () => {
  let internalController: InternalController;
  let accountsServiceMock: { listAccounts: jest.Mock; createAccount: jest.Mock };

  beforeEach(async () => {
    accountsServiceMock = {
      listAccounts: jest.fn(),
      createAccount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InternalController],
      providers: [
        { provide: AccountsService, useValue: accountsServiceMock },
      ],
    })
      .overrideGuard(InternalGuard)
      .useValue(internalGuardAlwaysAllow)
      .compile();

    internalController = module.get<InternalController>(InternalController);
  });

  describe('listAccounts — sans filtre de rôle', () => {
    it('retourne la liste complète des comptes avec userId, role et email', async () => {
      const expectedAccountList = [
        buildAccountSummary({ userId: 'uuid-1', role: UserRole.ELEVE, email: 'eleve@example.com' }),
        buildAccountSummary({ userId: 'uuid-2', role: UserRole.FORMATEUR, email: 'formateur@example.com' }),
        buildAccountSummary({ userId: 'uuid-3', role: UserRole.PARENT_FINANCEUR, email: 'parent@example.com' }),
      ];
      accountsServiceMock.listAccounts.mockResolvedValue(expectedAccountList);

      const result = await internalController.listAccounts(undefined);

      expect(result).toEqual(expectedAccountList);
      expect(accountsServiceMock.listAccounts).toHaveBeenCalledWith(undefined);
    });

    it('retourne un tableau vide quand aucun compte n\'existe', async () => {
      accountsServiceMock.listAccounts.mockResolvedValue([]);

      const result = await internalController.listAccounts(undefined);

      expect(result).toEqual([]);
    });

    it('retourne les champs userId, role, email, firstName, lastName, phone (pas de mot de passe)', async () => {
      const expectedAccountList = [
        buildAccountSummary({ userId: 'uuid-1', role: UserRole.ELEVE, email: 'eleve@example.com', firstName: 'Alice', lastName: 'Dupont', phone: '+33601020304' }),
      ];
      accountsServiceMock.listAccounts.mockResolvedValue(expectedAccountList);

      const result = await internalController.listAccounts(undefined);

      expect(result[0]).toHaveProperty('userId');
      expect(result[0]).toHaveProperty('role');
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('firstName', 'Alice');
      expect(result[0]).toHaveProperty('lastName', 'Dupont');
      expect(result[0]).toHaveProperty('phone', '+33601020304');
      expect(result[0]).not.toHaveProperty('passwordHash');
      expect(result[0]).not.toHaveProperty('password');
    });

    it('retourne firstName, lastName, phone à null quand les champs ne sont pas renseignés', async () => {
      const expectedAccountList = [
        buildAccountSummary({ userId: 'uuid-1', role: UserRole.ELEVE, email: 'eleve@example.com' }),
      ];
      accountsServiceMock.listAccounts.mockResolvedValue(expectedAccountList);

      const result = await internalController.listAccounts(undefined);

      expect(result[0]).toHaveProperty('firstName', null);
      expect(result[0]).toHaveProperty('lastName', null);
      expect(result[0]).toHaveProperty('phone', null);
    });
  });

  describe('listAccounts — avec filtre ?role=', () => {
    it('transmet le rôle ELEVE au service et retourne les comptes filtrés', async () => {
      const eleveAccountList = [
        buildAccountSummary({ userId: 'uuid-1', role: UserRole.ELEVE, email: 'eleve1@example.com' }),
        buildAccountSummary({ userId: 'uuid-2', role: UserRole.ELEVE, email: 'eleve2@example.com' }),
      ];
      accountsServiceMock.listAccounts.mockResolvedValue(eleveAccountList);

      const result = await internalController.listAccounts(UserRole.ELEVE);

      expect(accountsServiceMock.listAccounts).toHaveBeenCalledWith(UserRole.ELEVE);
      expect(result).toHaveLength(2);
      expect(result.every((account) => account.role === UserRole.ELEVE)).toBe(true);
    });

    it('transmet le rôle FORMATEUR au service et retourne les formateurs', async () => {
      const formateurAccountList = [
        buildAccountSummary({ userId: 'uuid-3', role: UserRole.FORMATEUR, email: 'formateur@example.com' }),
      ];
      accountsServiceMock.listAccounts.mockResolvedValue(formateurAccountList);

      const result = await internalController.listAccounts(UserRole.FORMATEUR);

      expect(accountsServiceMock.listAccounts).toHaveBeenCalledWith(UserRole.FORMATEUR);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe(UserRole.FORMATEUR);
    });

    it('retourne un tableau vide si aucun compte ne correspond au rôle filtré', async () => {
      accountsServiceMock.listAccounts.mockResolvedValue([]);

      const result = await internalController.listAccounts(UserRole.ANIMATEUR_PEDAGOGIQUE);

      expect(accountsServiceMock.listAccounts).toHaveBeenCalledWith(UserRole.ANIMATEUR_PEDAGOGIQUE);
      expect(result).toEqual([]);
    });
  });
});
