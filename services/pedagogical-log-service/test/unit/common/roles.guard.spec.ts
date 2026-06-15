/**
 * Unit tests — RolesGuard
 *
 * Couvre :
 *   - Passe si aucun rôle requis (route publique ou sans décorateur)
 *   - Passe si user.role est dans la liste des rôles requis
 *   - Lève ForbiddenException si user.role n'est pas dans la liste
 *   - Lève ForbiddenException si user est absent (token mal parsé)
 *
 * Régression #FIX-403 : GET /memos doit autoriser ADMINISTRATEUR_FINANCIER.
 * Le guard lui-même est générique — c'est le contrôleur qui déclare les rôles.
 * On simule ici une liste incluant 'administrateur_financier' pour valider
 * que le guard l'accepte correctement.
 */

import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { ROLES_KEY } from '../../../src/common/decorators/roles.decorator';
import { UserRole } from '../../../src/common/enums/user-role.enum';

function buildMockExecutionContext(
  userRole: string | undefined,
  requiredRoles: UserRole[] | undefined,
): ExecutionContext {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(requiredRoles);

  const mockRequest = { user: userRole ? { role: userRole } : undefined };
  const mockHttpArgs = { getRequest: () => mockRequest };

  return {
    getHandler: jest.fn(),
    getClass:   jest.fn(),
    switchToHttp: () => mockHttpArgs,
  } as unknown as ExecutionContext;
}

const ALLOWED_ROLES_FOR_MEMO_LIST = [
  UserRole.FORMATEUR,
  UserRole.RESPONSABLE_PEDAGOGIQUE,
  UserRole.ANIMATEUR_PEDAGOGIQUE,
  UserRole.TECHNICIEN_INFORMATIQUE,
  UserRole.ADMINISTRATEUR_FINANCIER,
];

describe('RolesGuard', () => {
  let rolesGuard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    rolesGuard = new RolesGuard(reflector);
  });

  it('autorise si aucun rôle requis (required est undefined)', () => {
    const context = buildMockExecutionContext('eleve', undefined);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('autorise si la liste de rôles requis est vide', () => {
    const context = buildMockExecutionContext('eleve', []);
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  describe('Accès à GET /memos (liste de rôles réelle après correctif)', () => {
    it('autorise FORMATEUR', () => {
      const context = buildMockExecutionContext('formateur', ALLOWED_ROLES_FOR_MEMO_LIST);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ALLOWED_ROLES_FOR_MEMO_LIST);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('autorise RESPONSABLE_PEDAGOGIQUE', () => {
      const context = buildMockExecutionContext('responsable_pedagogique', ALLOWED_ROLES_FOR_MEMO_LIST);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ALLOWED_ROLES_FOR_MEMO_LIST);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('autorise ANIMATEUR_PEDAGOGIQUE', () => {
      const context = buildMockExecutionContext('animateur_pedagogique', ALLOWED_ROLES_FOR_MEMO_LIST);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ALLOWED_ROLES_FOR_MEMO_LIST);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('autorise TECHNICIEN_INFORMATIQUE', () => {
      const context = buildMockExecutionContext('technicien_informatique', ALLOWED_ROLES_FOR_MEMO_LIST);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ALLOWED_ROLES_FOR_MEMO_LIST);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    /**
     * Régression #FIX-403 — ce cas était bloqué avant le correctif car
     * 'administrateur_financier' était absent de la liste @Roles() sur GET /memos.
     */
    it('[#FIX-403] autorise ADMINISTRATEUR_FINANCIER', () => {
      const context = buildMockExecutionContext('administrateur_financier', ALLOWED_ROLES_FOR_MEMO_LIST);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ALLOWED_ROLES_FOR_MEMO_LIST);
      expect(rolesGuard.canActivate(context)).toBe(true);
    });

    it('refuse ELEVE → ForbiddenException', () => {
      const context = buildMockExecutionContext('eleve', ALLOWED_ROLES_FOR_MEMO_LIST);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ALLOWED_ROLES_FOR_MEMO_LIST);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('refuse PARENT_FINANCEUR → ForbiddenException', () => {
      const context = buildMockExecutionContext('parent_financeur', ALLOWED_ROLES_FOR_MEMO_LIST);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ALLOWED_ROLES_FOR_MEMO_LIST);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('refuse si user est absent (requête sans payload) → ForbiddenException', () => {
      const context = buildMockExecutionContext(undefined, ALLOWED_ROLES_FOR_MEMO_LIST);
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(ALLOWED_ROLES_FOR_MEMO_LIST);
      expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
