import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { ROLES_KEY } from '../../../src/common/decorators/roles.decorator';
import { OWNER_ACCESS_KEY } from '../../../src/common/decorators/owner-access.decorator';
import { UserRole } from '../../../src/common/enums/user-role.enum';

/**
 * The 2026-08-11 defect lived here, not in the services: a formateur asking for their own
 * financial profile was rejected with "Insufficient role" before the ownership check in the
 * service could ever run. These tests pin the HTTP-level behaviour.
 */
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const buildContext = (user: { id: string; role: string } | undefined): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
    }) as unknown as ExecutionContext;

  /** Mimics the metadata a route carries: @OwnerAccess() and/or @Roles(...). */
  const withMetadata = (metadata: {
    ownerAccess?: boolean;
    roles?: UserRole[];
  }): void => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: string) => {
        if (key === OWNER_ACCESS_KEY) return metadata.ownerAccess;
        if (key === ROLES_KEY) return metadata.roles;
        return undefined;
      });
  };

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
    jest.clearAllMocks();
  });

  describe('routes marked @OwnerAccess() — no role filtering at the HTTP layer', () => {
    const everyRole = Object.values(UserRole);

    it.each(everyRole)('lets a %s through so the service can check ownership', (role) => {
      withMetadata({ ownerAccess: true });

      expect(guard.canActivate(buildContext({ id: 'user-1', role }))).toBe(true);
    });

    it('still requires an authenticated user', () => {
      withMetadata({ ownerAccess: true });

      expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
    });
  });

  describe('routes carrying @Roles(...) — allowlist still enforced', () => {
    it('lets an allowed role through', () => {
      withMetadata({ roles: [UserRole.ADMINISTRATEUR_FINANCIER] });

      expect(
        guard.canActivate(
          buildContext({ id: 'af-1', role: UserRole.ADMINISTRATEUR_FINANCIER }),
        ),
      ).toBe(true);
    });

    it('rejects a role outside the allowlist', () => {
      withMetadata({ roles: [UserRole.ADMINISTRATEUR_FINANCIER] });

      expect(() =>
        guard.canActivate(buildContext({ id: 'teacher-1', role: UserRole.FORMATEUR })),
      ).toThrow(ForbiddenException);
    });

    it('rejects an unauthenticated caller', () => {
      withMetadata({ roles: [UserRole.ADMINISTRATEUR_FINANCIER] });

      expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
    });

    it('keeps the write allowlist closed to formateur and animateur_pedagogique', () => {
      // PATCH /financial-profiles/:ownerId — unchanged by the read-side fix.
      withMetadata({
        roles: [
          UserRole.PARENT_FINANCEUR,
          UserRole.ADMINISTRATEUR_FINANCIER,
          UserRole.TECHNICIEN_INFORMATIQUE,
        ],
      });

      expect(() =>
        guard.canActivate(buildContext({ id: 'teacher-1', role: UserRole.FORMATEUR })),
      ).toThrow(ForbiddenException);
      expect(() =>
        guard.canActivate(
          buildContext({ id: 'ap-1', role: UserRole.ANIMATEUR_PEDAGOGIQUE }),
        ),
      ).toThrow(ForbiddenException);
    });
  });

  describe('routes with no metadata at all', () => {
    it('lets the request through', () => {
      withMetadata({});

      expect(guard.canActivate(buildContext({ id: 'user-1', role: UserRole.ELEVE }))).toBe(true);
    });
  });
});
