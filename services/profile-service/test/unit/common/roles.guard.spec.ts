import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { ROLES_KEY } from '../../../src/common/decorators/roles.decorator';
import { OWNER_ACCESS_KEY } from '../../../src/common/decorators/owner-access.decorator';

const makeMockExecutionContext = (userRole: UserRole | null): ExecutionContext => ({
  getHandler: jest.fn(),
  getClass: jest.fn(),
  switchToHttp: jest.fn().mockReturnValue({
    getRequest: jest.fn().mockReturnValue({
      user: userRole !== null ? { id: 'actor-uuid', role: userRole } : undefined,
    }),
  }),
} as unknown as ExecutionContext);

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  /**
   * Le guard interroge DEUX clés de métadonnée distinctes (`ownerAccess` puis
   * `roles`). Le mock répond donc par clé : lui faire renvoyer la même valeur
   * aux deux appels ferait passer une liste de rôles pour un marqueur
   * `@OwnerAccess()` et ouvrirait la route à tout le monde dans les tests, sans
   * que rien ne le signale.
   */
  const metadata = (values: { ownerAccess?: boolean; roles?: UserRole[] }) => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === OWNER_ACCESS_KEY) return values.ownerAccess as never;
      if (key === ROLES_KEY) return values.roles as never;
      return undefined as never;
    });
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  it('allows access when no roles are required on the route', () => {
    metadata({});
    const context = makeMockExecutionContext(UserRole.ELEVE);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when required roles list is empty', () => {
    metadata({ roles: [] });
    const context = makeMockExecutionContext(UserRole.ELEVE);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when actor role matches a required role', () => {
    metadata({ roles: [UserRole.RESPONSABLE_PEDAGOGIQUE] });
    const context = makeMockExecutionContext(UserRole.RESPONSABLE_PEDAGOGIQUE);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when actor role matches one of multiple required roles', () => {
    metadata({ roles: [UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ADMINISTRATEUR_FINANCIER] });
    const context = makeMockExecutionContext(UserRole.ADMINISTRATEUR_FINANCIER);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws 403 when actor role does not match required roles', () => {
    metadata({ roles: [UserRole.RESPONSABLE_PEDAGOGIQUE] });
    const context = makeMockExecutionContext(UserRole.ELEVE);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws 403 when no user is attached to the request', () => {
    metadata({ roles: [UserRole.RESPONSABLE_PEDAGOGIQUE] });
    const context = makeMockExecutionContext(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('reads roles metadata from both handler and class using ROLES_KEY', () => {
    metadata({ roles: [UserRole.TECHNICIEN_INFORMATIQUE] });
    const context = makeMockExecutionContext(UserRole.TECHNICIEN_INFORMATIQUE);
    guard.canActivate(context);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });

  // ---------------------------------------------------------------------------
  // @OwnerAccess() — la décision appartient au service, pas au guard
  // ---------------------------------------------------------------------------
  describe('@OwnerAccess()', () => {
    it.each([
      UserRole.ELEVE,
      UserRole.PARENT_FINANCEUR,
      UserRole.FORMATEUR,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ])('laisse passer %s : aucun rôle ne peut être oublié dans une liste inexistante', (role) => {
      metadata({ ownerAccess: true });
      expect(guard.canActivate(makeMockExecutionContext(role))).toBe(true);
    });

    it('exige tout de même un appelant authentifié', () => {
      metadata({ ownerAccess: true });
      expect(() => guard.canActivate(makeMockExecutionContext(null))).toThrow(ForbiddenException);
    });

    it('lit la métadonnée sur la méthode ET sur la classe', () => {
      metadata({ ownerAccess: true });
      const context = makeMockExecutionContext(UserRole.ELEVE);
      guard.canActivate(context);
      expect(reflector.getAllAndOverride).toHaveBeenCalledWith(OWNER_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    });

    it('prime sur une éventuelle liste de rôles laissée sur la route', () => {
      metadata({ ownerAccess: true, roles: [UserRole.RESPONSABLE_PEDAGOGIQUE] });
      expect(guard.canActivate(makeMockExecutionContext(UserRole.FORMATEUR))).toBe(true);
    });
  });
});
