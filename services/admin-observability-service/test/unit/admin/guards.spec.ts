/**
 * Unit tests — JwtAuthGuard and RolesGuard
 */

import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import { ROLES_KEY } from '../../../src/common/decorators/roles.decorator';
import { UserRole } from '../../../src/common/enums/user-role.enum';

function buildMockExecutionContext(headers: Record<string, string> = {}, user: any = null): ExecutionContext {
  const request = { headers, user };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  let jwtAuthGuard: JwtAuthGuard;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(() => {
    jwtService = { verify: jest.fn() } as any;
    configService = { get: jest.fn().mockReturnValue('test-secret') } as any;
    jwtAuthGuard = new JwtAuthGuard(jwtService, configService);
  });

  it('lève UnauthorizedException si Authorization header est absent', () => {
    const context = buildMockExecutionContext({});
    expect(() => jwtAuthGuard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('lève UnauthorizedException si le token est invalide', () => {
    jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });
    const context = buildMockExecutionContext({ authorization: 'Bearer invalid-token' });
    expect(() => jwtAuthGuard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('lève UnauthorizedException si le type de token n\'est pas "access"', () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-001',
      email: 'ti@visiomaths.fr',
      role: 'technicien_informatique',
      validationStatus: 'validated',
      jti: 'jti-001',
      type: 'refresh',
    });
    const context = buildMockExecutionContext({ authorization: 'Bearer valid-but-refresh-token' });
    expect(() => jwtAuthGuard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('accepte un token access valide et attache l\'utilisateur à la requête', () => {
    const payload = {
      sub: 'ti-001',
      email: 'ti@visiomaths.fr',
      role: 'technicien_informatique',
      validationStatus: 'validated',
      jti: 'jti-001',
      type: 'access',
    };
    jwtService.verify.mockReturnValue(payload);

    const request = { headers: { authorization: 'Bearer valid-token' }, user: null };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    const result = jwtAuthGuard.canActivate(context);

    expect(result).toBe(true);
    expect(request.user).toMatchObject({
      id: 'ti-001',
      role: 'technicien_informatique',
    });
  });
});

describe('RolesGuard', () => {
  let rolesGuard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    rolesGuard = new RolesGuard(reflector);
  });

  it('retourne true si aucun rôle requis n\'est défini', () => {
    reflector.getAllAndOverride.mockReturnValue([]);
    const context = buildMockExecutionContext({}, { role: 'eleve' });
    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('retourne true si l\'utilisateur possède le rôle requis', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.TECHNICIEN_INFORMATIQUE]);
    const context = buildMockExecutionContext({}, { role: 'technicien_informatique' });
    expect(rolesGuard.canActivate(context)).toBe(true);
  });

  it('lève ForbiddenException si l\'utilisateur ne possède pas le rôle requis', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.TECHNICIEN_INFORMATIQUE]);
    const context = buildMockExecutionContext({}, { role: 'formateur' });
    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('lève ForbiddenException si l\'utilisateur est absent', () => {
    reflector.getAllAndOverride.mockReturnValue([UserRole.TECHNICIEN_INFORMATIQUE]);
    const context = buildMockExecutionContext({}, null);
    expect(() => rolesGuard.canActivate(context)).toThrow(ForbiddenException);
  });
});
