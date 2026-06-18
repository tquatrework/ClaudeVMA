import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from '../../../../src/common/guards/roles.guard';
import { UserRole } from '../../../../src/common/enums/user-role.enum';
import { ROLES_KEY } from '../../../../src/common/decorators/roles.decorator';

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockReflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    mockReflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(mockReflector as unknown as Reflector);
  });

  it('retourne true si aucun rôle requis n\'est défini sur la route', () => {
    mockReflector.getAllAndOverride.mockReturnValue(null);
    const context = buildMockExecutionContext({ role: UserRole.ELEVE });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('retourne true si la liste de rôles requis est vide', () => {
    mockReflector.getAllAndOverride.mockReturnValue([]);
    const context = buildMockExecutionContext({ role: UserRole.ELEVE });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('retourne true si le rôle de l\'utilisateur figure dans les rôles requis', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.RESPONSABLE_PEDAGOGIQUE]);
    const context = buildMockExecutionContext({ role: UserRole.RESPONSABLE_PEDAGOGIQUE });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockReflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('lève ForbiddenException si le rôle de l\'utilisateur ne figure pas dans les rôles requis', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.RESPONSABLE_PEDAGOGIQUE]);
    const context = buildMockExecutionContext({ role: UserRole.ELEVE });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lève ForbiddenException si request.user est absent (token mal transmis)', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.ELEVE]);
    const context = buildMockExecutionContext(null);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('retourne true si plusieurs rôles sont autorisés et l\'utilisateur en possède un', () => {
    mockReflector.getAllAndOverride.mockReturnValue([
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
    ]);
    const context = buildMockExecutionContext({ role: UserRole.TECHNICIEN_INFORMATIQUE });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it('lève ForbiddenException si l\'AP tente d\'accéder à une route réservée RP', () => {
    mockReflector.getAllAndOverride.mockReturnValue([UserRole.RESPONSABLE_PEDAGOGIQUE]);
    const context = buildMockExecutionContext({ role: UserRole.ANIMATEUR_PEDAGOGIQUE });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('retourne true si l\'AP accède à une route autorisant AP et RP', () => {
    mockReflector.getAllAndOverride.mockReturnValue([
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ANIMATEUR_PEDAGOGIQUE,
    ]);
    const context = buildMockExecutionContext({ role: UserRole.ANIMATEUR_PEDAGOGIQUE });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});
