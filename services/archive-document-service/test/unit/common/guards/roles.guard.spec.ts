import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../../src/common/guards/roles.guard';
import { UserRole } from '../../../../src/common/enums/user-role.enum';
import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';
import { OWNER_ACCESS_KEY } from '../../../../src/common/decorators/owner-access.decorator';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMockExecutionContext(user: Record<string, unknown> | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

/**
 * Le guard interroge DEUX métadonnées : `@OwnerAccess()` puis `@Roles()`.
 * Le reflector simulé répond par clé, sinon les deux lectures se confondent.
 */
function buildReflector(metadata: { ownerAccess?: boolean; roles?: UserRole[] }) {
  return {
    getAllAndOverride: jest.fn((key: string) =>
      key === OWNER_ACCESS_KEY ? metadata.ownerAccess : metadata.roles,
    ),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  describe('routes classiques, pilotées par une liste de rôles', () => {
    it('retourne true si aucun rôle requis n\'est défini sur la route', () => {
      const guard = new RolesGuard(buildReflector({}) as unknown as Reflector);

      expect(guard.canActivate(buildMockExecutionContext({ role: UserRole.ELEVE }))).toBe(true);
    });

    it('retourne true si la liste de rôles requis est vide', () => {
      const guard = new RolesGuard(buildReflector({ roles: [] }) as unknown as Reflector);

      expect(guard.canActivate(buildMockExecutionContext({ role: UserRole.ELEVE }))).toBe(true);
    });

    it('retourne true si le rôle de l\'utilisateur figure dans les rôles requis', () => {
      const reflector = buildReflector({ roles: [UserRole.RESPONSABLE_PEDAGOGIQUE] });
      const guard = new RolesGuard(reflector as unknown as Reflector);

      const result = guard.canActivate(
        buildMockExecutionContext({ role: UserRole.RESPONSABLE_PEDAGOGIQUE }),
      );

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
    });

    it('lève ForbiddenException si le rôle ne figure pas dans les rôles requis', () => {
      const guard = new RolesGuard(
        buildReflector({ roles: [UserRole.RESPONSABLE_PEDAGOGIQUE] }) as unknown as Reflector,
      );

      expect(() => guard.canActivate(buildMockExecutionContext({ role: UserRole.ELEVE }))).toThrow(
        ForbiddenException,
      );
    });

    it('lève ForbiddenException si request.user est absent (token mal transmis)', () => {
      const guard = new RolesGuard(
        buildReflector({ roles: [UserRole.ELEVE] }) as unknown as Reflector,
      );

      expect(() => guard.canActivate(buildMockExecutionContext(null))).toThrow(ForbiddenException);
    });

    it('retourne true si plusieurs rôles sont autorisés et l\'utilisateur en possède un', () => {
      const guard = new RolesGuard(
        buildReflector({
          roles: [UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE],
        }) as unknown as Reflector,
      );

      expect(
        guard.canActivate(buildMockExecutionContext({ role: UserRole.TECHNICIEN_INFORMATIQUE })),
      ).toBe(true);
    });
  });

  describe('routes @OwnerAccess() — pilotées par la relation', () => {
    it.each([
      [UserRole.ELEVE],
      [UserRole.PARENT_FINANCEUR],
      [UserRole.FORMATEUR],
      [UserRole.ANIMATEUR_PEDAGOGIQUE],
      [UserRole.RESPONSABLE_PEDAGOGIQUE],
      [UserRole.TECHNICIEN_INFORMATIQUE],
      [UserRole.ADMINISTRATEUR_FINANCIER],
    ])('laisse passer le rôle %s : aucun rôle n\'est filtré au niveau du guard', (role) => {
      const guard = new RolesGuard(
        buildReflector({ ownerAccess: true }) as unknown as Reflector,
      );

      expect(guard.canActivate(buildMockExecutionContext({ role }))).toBe(true);
    });

    it('exige tout de même un appelant authentifié', () => {
      const guard = new RolesGuard(
        buildReflector({ ownerAccess: true }) as unknown as Reflector,
      );

      expect(() => guard.canActivate(buildMockExecutionContext(null))).toThrow(ForbiddenException);
    });

    it('ignore une liste de rôles qui traînerait sur la même route', () => {
      // Garde-fou : si quelqu'un rajoute un jour @Roles() à côté d'@OwnerAccess(),
      // le titulaire ne doit pas se voir refuser ses propres archives.
      const guard = new RolesGuard(
        buildReflector({
          ownerAccess: true,
          roles: [UserRole.RESPONSABLE_PEDAGOGIQUE],
        }) as unknown as Reflector,
      );

      expect(guard.canActivate(buildMockExecutionContext({ role: UserRole.ELEVE }))).toBe(true);
    });
  });
});
