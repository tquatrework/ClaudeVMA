import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { RolesGuard } from '../../src/common/roles.guard';
import { UserRole } from '../../src/common/user-role.enum';

describe('RolesGuard', () => {
  it('allows the request when the actor role is in the declared roles (nominal)', () => {
    const reflector = { getAllAndOverride: jest.fn(() => [UserRole.RESPONSABLE_PEDAGOGIQUE]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'rp-1', role: UserRole.RESPONSABLE_PEDAGOGIQUE } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when the actor role is not in the declared roles (error)', () => {
    const reflector = { getAllAndOverride: jest.fn(() => [UserRole.RESPONSABLE_PEDAGOGIQUE]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'teacher-1', role: UserRole.FORMATEUR } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when there is no authenticated user on the request', () => {
    const reflector = { getAllAndOverride: jest.fn(() => [UserRole.RESPONSABLE_PEDAGOGIQUE]) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({}) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows the request when the route declares no @Roles metadata (unrestricted route)', () => {
    const reflector = { getAllAndOverride: jest.fn(() => undefined) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'x', role: UserRole.ADMINISTRATEUR_FINANCIER } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows the request when @Roles declares an empty array', () => {
    const reflector = { getAllAndOverride: jest.fn(() => []) } as unknown as Reflector;
    const guard = new RolesGuard(reflector);
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'x', role: UserRole.ELEVE } }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);
  });
});
