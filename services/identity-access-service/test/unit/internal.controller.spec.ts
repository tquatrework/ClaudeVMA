import { Test, TestingModule } from '@nestjs/testing';
import { CanActivate } from '@nestjs/common';
import { InternalController } from '../../src/internal/internal.controller';
import { AccountsService } from '../../src/accounts/accounts.service';
import { InternalGuard } from '../../src/internal/internal.guard';
import { UserRole } from '../../src/auth/entities/user.entity';
import { ListAccountsQueryDto } from '../../src/internal/dto/list-accounts-query.dto';

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
  let accountsServiceMock: {
    listAccounts: jest.Mock;
    createAccount: jest.Mock;
    findByUserId: jest.Mock;
    findByLoginIdentifier: jest.Mock;
  };

  beforeEach(async () => {
    accountsServiceMock = {
      listAccounts: jest.fn(),
      createAccount: jest.fn(),
      findByUserId: jest.fn(),
      findByLoginIdentifier: jest.fn(),
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

      const result = await internalController.listAccounts({} as ListAccountsQueryDto);

      expect(result).toEqual(expectedAccountList);
      expect(accountsServiceMock.listAccounts).toHaveBeenCalledWith(undefined);
    });

    it('retourne un tableau vide quand aucun compte n\'existe', async () => {
      accountsServiceMock.listAccounts.mockResolvedValue([]);

      const result = await internalController.listAccounts({} as ListAccountsQueryDto);

      expect(result).toEqual([]);
    });

    it('retourne les champs userId, role, email, firstName, lastName, phone (pas de mot de passe)', async () => {
      const expectedAccountList = [
        buildAccountSummary({ userId: 'uuid-1', role: UserRole.ELEVE, email: 'eleve@example.com', firstName: 'Alice', lastName: 'Dupont', phone: '+33601020304' }),
      ];
      accountsServiceMock.listAccounts.mockResolvedValue(expectedAccountList);

      const result = await internalController.listAccounts({} as ListAccountsQueryDto);

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

      const result = await internalController.listAccounts({} as ListAccountsQueryDto);

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

      const result = await internalController.listAccounts({ role: UserRole.ELEVE });

      expect(accountsServiceMock.listAccounts).toHaveBeenCalledWith(UserRole.ELEVE);
      expect(result).toHaveLength(2);
      expect(result.every((account) => account.role === UserRole.ELEVE)).toBe(true);
    });

    it('transmet le rôle FORMATEUR au service et retourne les formateurs', async () => {
      const formateurAccountList = [
        buildAccountSummary({ userId: 'uuid-3', role: UserRole.FORMATEUR, email: 'formateur@example.com' }),
      ];
      accountsServiceMock.listAccounts.mockResolvedValue(formateurAccountList);

      const result = await internalController.listAccounts({ role: UserRole.FORMATEUR });

      expect(accountsServiceMock.listAccounts).toHaveBeenCalledWith(UserRole.FORMATEUR);
      expect(result).toHaveLength(1);
      expect(result[0].role).toBe(UserRole.FORMATEUR);
    });

    it('retourne un tableau vide si aucun compte ne correspond au rôle filtré', async () => {
      accountsServiceMock.listAccounts.mockResolvedValue([]);

      const result = await internalController.listAccounts({ role: UserRole.ANIMATEUR_PEDAGOGIQUE });

      expect(accountsServiceMock.listAccounts).toHaveBeenCalledWith(UserRole.ANIMATEUR_PEDAGOGIQUE);
      expect(result).toEqual([]);
    });
  });

  describe('GET /internal/accounts/by-user-id/:userId', () => {
    it('délègue à AccountsService.findByUserId avec un UUID valide', async () => {
      const expected = { userId: '87482274-1ef2-412a-827b-75fc48c28370', loginIdentifier: 'eleve.test', role: UserRole.ELEVE };
      accountsServiceMock.findByUserId.mockResolvedValue(expected);

      const result = await internalController.findByUserId('87482274-1ef2-412a-827b-75fc48c28370');

      expect(result).toEqual(expected);
      expect(accountsServiceMock.findByUserId).toHaveBeenCalledWith('87482274-1ef2-412a-827b-75fc48c28370');
    });
    // Note : la validation du format UUID est déléguée à ParseUUIDPipe (implémentation
    // NestJS déjà testée en amont) — non ré-exercée ici au niveau de l'appel direct.
  });

  describe('GET /internal/accounts/by-login-identifier', () => {
    it('délègue à AccountsService.findByLoginIdentifier', async () => {
      const expected = { userId: 'uuid-1', role: UserRole.ELEVE };
      accountsServiceMock.findByLoginIdentifier.mockResolvedValue(expected);

      const result = await internalController.findByLoginIdentifier('eleve.test');

      expect(result).toEqual(expected);
      expect(accountsServiceMock.findByLoginIdentifier).toHaveBeenCalledWith('eleve.test');
    });
  });
});
