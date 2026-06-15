import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { UserRole } from '../../../src/common/enums/user-role.enum';
import { ROLES_KEY } from '../../../src/common/decorators/roles.decorator';

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

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  it('allows access when no roles are required on the route', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = makeMockExecutionContext(UserRole.ELEVE);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when required roles list is empty', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = makeMockExecutionContext(UserRole.ELEVE);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when actor role matches a required role', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.RESPONSABLE_PEDAGOGIQUE]);
    const context = makeMockExecutionContext(UserRole.RESPONSABLE_PEDAGOGIQUE);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when actor role matches one of multiple required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ]);
    const context = makeMockExecutionContext(UserRole.ADMINISTRATEUR_FINANCIER);
    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws 403 when actor role does not match required roles', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.RESPONSABLE_PEDAGOGIQUE]);
    const context = makeMockExecutionContext(UserRole.ELEVE);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws 403 when no user is attached to the request', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.RESPONSABLE_PEDAGOGIQUE]);
    const context = makeMockExecutionContext(null);
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('reads roles metadata from both handler and class using ROLES_KEY', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.TECHNICIEN_INFORMATIQUE]);
    const context = makeMockExecutionContext(UserRole.TECHNICIEN_INFORMATIQUE);
    guard.canActivate(context);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
  });
});
