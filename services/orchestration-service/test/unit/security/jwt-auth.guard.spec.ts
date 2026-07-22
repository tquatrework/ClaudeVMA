import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../../../src/security/jwt-auth.guard';

const makeContext = (authHeader?: string): ExecutionContext => {
  const request: { headers: Record<string, string>; user?: unknown } = {
    headers: authHeader ? { authorization: authHeader } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
};

describe('JwtAuthGuard', () => {
  let jwtService: { verify: jest.Mock };
  let configService: { getOrThrow: jest.Mock };
  let guard: JwtAuthGuard;

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    configService = { getOrThrow: jest.fn().mockReturnValue('test_jwt_secret') };
    guard = new JwtAuthGuard(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
  });

  it('allows access and attaches the user for a valid access token — nominal case', () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-1',
      loginIdentifier: 'user-1@visiomath.fr',
      email: 'user-1@visiomath.fr',
      role: 'student',
      validationStatus: 'validated',
      jti: 'jti-1',
      type: 'access',
    });

    const context = makeContext('Bearer valid-token');

    expect(guard.canActivate(context)).toBe(true);
    expect(jwtService.verify).toHaveBeenCalledWith('valid-token', {
      secret: 'test_jwt_secret',
    });
    expect(configService.getOrThrow).toHaveBeenCalledWith('JWT_SECRET');
    expect(context.switchToHttp().getRequest().user).toEqual({
      id: 'user-1',
      loginIdentifier: 'user-1@visiomath.fr',
      email: 'user-1@visiomath.fr',
      role: 'student',
      validationStatus: 'validated',
      jti: 'jti-1',
    });
  });

  it('throws UnauthorizedException when Authorization header is missing — error case', () => {
    const context = makeContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    expect(jwtService.verify).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when Authorization header is malformed — error case', () => {
    const context = makeContext('Token abc');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the token is invalid or expired — error case', () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });

    const context = makeContext('Bearer expired-token');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException when the token type is not "access" — error case', () => {
    jwtService.verify.mockReturnValue({
      sub: 'user-2',
      loginIdentifier: 'user-2@visiomath.fr',
      email: 'user-2@visiomath.fr',
      role: 'teacher',
      validationStatus: 'validated',
      jti: 'jti-2',
      type: 'refresh',
    });

    const context = makeContext('Bearer refresh-token');

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
