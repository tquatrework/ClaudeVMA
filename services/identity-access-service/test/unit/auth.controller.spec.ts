import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';

const mockTokenResponse = {
  access_token: 'signed-access-token',
  refresh_token: 'signed-refresh-token',
  user: {
    id: 'user-uuid',
    email: 'test@example.com',
    role: UserRole.ELEVE,
    validationStatus: ValidationStatus.ACTIVE,
  },
};

const mockAuthService = {
  login: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  requestPasswordReset: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe('POST /auth/login', () => {
    it('returns token pair for valid credentials', async () => {
      mockAuthService.login.mockResolvedValue(mockTokenResponse);

      const result = await controller.login(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(result).toEqual(mockTokenResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        { email: 'test@example.com', password: 'password123' },
        '127.0.0.1',
        'Mozilla/5.0',
      );
    });

    it('propagates 401 when auth service throws UnauthorizedException', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(
        controller.login({ email: 'x@x.com', password: 'wrong' }, '127.0.0.1', 'Mozilla'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/logout', () => {
    it('calls logout with the jti from the authenticated user and returns success message', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const mockRequest = { user: { jti: 'jti-uuid' } };
      const result = await controller.logout(mockRequest);

      expect(mockAuthService.logout).toHaveBeenCalledWith('jti-uuid');
      expect(result).toEqual({ message: 'Session revoked' });
    });
  });

  describe('POST /auth/refresh', () => {
    it('returns new token pair for valid refresh token', async () => {
      const newTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        user: mockTokenResponse.user,
      };
      mockAuthService.refresh.mockResolvedValue(newTokenResponse);

      const result = await controller.refresh('valid-refresh-token');

      expect(result).toHaveProperty('access_token');
      expect(mockAuthService.refresh).toHaveBeenCalledWith('valid-refresh-token');
    });

    it('propagates 401 when refresh token is invalid', async () => {
      mockAuthService.refresh.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));

      await expect(controller.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GET /auth/me', () => {
    it('returns the authenticated user identity from the request', () => {
      const mockRequest = {
        user: {
          id: 'user-uuid',
          email: 'test@example.com',
          role: UserRole.ELEVE,
          validationStatus: ValidationStatus.ACTIVE,
          consentSigned: true,
        },
      };

      const result = controller.me(mockRequest);

      expect(result).toEqual({
        id: 'user-uuid',
        email: 'test@example.com',
        role: UserRole.ELEVE,
        validationStatus: ValidationStatus.ACTIVE,
        consentSigned: true,
      });
    });

    it('does not expose passwordHash in the response', () => {
      const mockRequest = {
        user: {
          id: 'user-uuid',
          email: 'test@example.com',
          role: UserRole.ELEVE,
          validationStatus: ValidationStatus.ACTIVE,
          consentSigned: false,
          passwordHash: 'secret-hash',
        },
      };

      const result = controller.me(mockRequest);

      expect(result).not.toHaveProperty('passwordHash');
    });
  });

  describe('POST /auth/password-reset/request', () => {
    it('returns success message for a known email (anti-enumeration)', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue({
        message: 'If the email is registered, a reset link will be sent.',
      });

      const result = await controller.requestPasswordReset({ email: 'test@example.com' }, '127.0.0.1');

      expect(result.message).toContain('reset link');
      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith('test@example.com', '127.0.0.1');
    });

    it('returns the same success message for an unknown email (anti-enumeration)', async () => {
      mockAuthService.requestPasswordReset.mockResolvedValue({
        message: 'If the email is registered, a reset link will be sent.',
      });

      const result = await controller.requestPasswordReset({ email: 'unknown@example.com' }, '127.0.0.1');

      expect(result.message).toContain('reset link');
    });
  });
});
