import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../../../src/common/guards/jwt-auth.guard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMockExecutionContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        headers,
        user: undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockJwtService: { verify: jest.Mock };
  let mockConfigService: { get: jest.Mock };

  const validPayload = {
    sub: 'user-uuid-1',
    email: 'eleve@example.com',
    role: 'eleve',
    validationStatus: 'active',
    jti: 'jti-uuid-1',
    type: 'access',
  };

  beforeEach(() => {
    mockJwtService = { verify: jest.fn() };
    mockConfigService = { get: jest.fn().mockReturnValue('test-jwt-secret') };

    guard = new JwtAuthGuard(
      mockJwtService as unknown as JwtService,
      mockConfigService as unknown as ConfigService,
    );
  });

  it('lève UnauthorizedException si le header Authorization est absent', () => {
    const context = buildMockExecutionContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('lève UnauthorizedException si le header Authorization ne commence pas par "Bearer "', () => {
    const context = buildMockExecutionContext({ authorization: 'Basic dXNlcjpwYXNz' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('lève UnauthorizedException si le token JWT est invalide ou expiré', () => {
    mockJwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const context = buildMockExecutionContext({ authorization: 'Bearer invalid.token.here' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('lève UnauthorizedException si le type de token n\'est pas "access" (ex. refresh token)', () => {
    mockJwtService.verify.mockReturnValue({ ...validPayload, type: 'refresh' });

    const context = buildMockExecutionContext({ authorization: 'Bearer valid.refresh.token' });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('attache request.user et retourne true avec un token d\'accès valide', () => {
    mockJwtService.verify.mockReturnValue(validPayload);

    const requestObject: Record<string, unknown> = {
      headers: { authorization: 'Bearer valid.access.token' },
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => requestObject,
      }),
    } as unknown as ExecutionContext;

    const result = guard.canActivate(context);

    expect(result).toBe(true);
    expect(requestObject['user']).toEqual({
      id: validPayload.sub,
      email: validPayload.email,
      role: validPayload.role,
      validationStatus: validPayload.validationStatus,
      jti: validPayload.jti,
    });
  });
});
