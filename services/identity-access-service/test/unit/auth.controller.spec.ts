import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';

const mockTokenResponse = {
  access_token: 'signed-access-token',
  refresh_token: 'signed-refresh-token',
  user: {
    id: 'user-uuid',
    loginIdentifier: 'test.user',
    email: 'test@example.com',
    role: UserRole.ELEVE,
    validationStatus: ValidationStatus.ACTIVE,
    emailVerified: false,
  },
};

const mockAuthService = {
  login: jest.fn(),
  logout: jest.fn(),
  refresh: jest.fn(),
  requestPasswordReset: jest.fn(),
  recoverIdentifier: jest.fn(),
  sendVerificationEmail: jest.fn(),
  verifyEmail: jest.fn(),
  resetPassword: jest.fn(),
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
    it('retourne une paire de tokens pour des identifiants valides', async () => {
      mockAuthService.login.mockResolvedValue(mockTokenResponse);

      const result = await controller.login(
        { loginIdentifier: 'test.user', password: 'password123' },
        '127.0.0.1',
        'Mozilla/5.0',
      );

      expect(result).toEqual(mockTokenResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith(
        { loginIdentifier: 'test.user', password: 'password123' },
        '127.0.0.1',
        'Mozilla/5.0',
      );
    });

    it('propage 401 quand le service lève UnauthorizedException', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(
        controller.login({ loginIdentifier: 'unknown.user', password: 'wrong' }, '127.0.0.1', 'Mozilla'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('POST /auth/logout', () => {
    it('appelle logout avec le jti de l\'utilisateur authentifié', async () => {
      mockAuthService.logout.mockResolvedValue(undefined);

      const mockRequest = { user: { jti: 'jti-uuid' } };
      const result = await controller.logout(mockRequest);

      expect(mockAuthService.logout).toHaveBeenCalledWith('jti-uuid');
      expect(result).toEqual({ message: 'Session revoked' });
    });
  });

  describe('POST /auth/refresh', () => {
    it('retourne une nouvelle paire de tokens pour un refresh token valide', async () => {
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

    it('propage 401 quand le refresh token est invalide', async () => {
      mockAuthService.refresh.mockRejectedValue(new UnauthorizedException('Invalid refresh token'));

      await expect(controller.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('GET /auth/me', () => {
    it('retourne l\'identité de l\'utilisateur authentifié avec le loginIdentifier', () => {
      const mockRequest = {
        user: {
          id: 'user-uuid',
          loginIdentifier: 'test.user',
          email: 'test@example.com',
          role: UserRole.ELEVE,
          validationStatus: ValidationStatus.ACTIVE,
          consentSigned: true,
        },
      };

      const result = controller.me(mockRequest);

      expect(result).toEqual({
        id: 'user-uuid',
        loginIdentifier: 'test.user',
        email: 'test@example.com',
        role: UserRole.ELEVE,
        validationStatus: ValidationStatus.ACTIVE,
        consentSigned: true,
      });
    });

    it('n\'expose pas le passwordHash dans la réponse', () => {
      const mockRequest = {
        user: {
          id: 'user-uuid',
          loginIdentifier: 'test.user',
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

  describe('POST /auth/send-verification-email', () => {
    it('appelle sendVerificationEmail avec l\'email fourni et retourne réponse neutre', async () => {
      const neutralResponse = {
        message: 'Si un compte non vérifié existe pour cette adresse, un email de vérification a été envoyé.',
      };
      mockAuthService.sendVerificationEmail.mockResolvedValue(neutralResponse);

      const result = await controller.sendVerificationEmail({ email: 'test@example.com' });

      expect(result).toEqual(neutralResponse);
      expect(mockAuthService.sendVerificationEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  describe('POST /auth/verify-email', () => {
    it('appelle verifyEmail avec le token et retourne succès', async () => {
      const successResponse = { message: 'Adresse email vérifiée avec succès.' };
      mockAuthService.verifyEmail.mockResolvedValue(successResponse);

      const result = await controller.verifyEmail({ token: 'valid-token-here-xx' });

      expect(result).toEqual(successResponse);
      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('valid-token-here-xx');
    });

    it('propage BadRequestException pour un token invalide', async () => {
      mockAuthService.verifyEmail.mockRejectedValue(
        new BadRequestException('Token de vérification invalide ou expiré.'),
      );

      await expect(controller.verifyEmail({ token: 'bad-token-xxxx' })).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /auth/recover-identifier', () => {
    it('retourne toujours un message neutre quelle que soit l\'adresse', async () => {
      const neutralResponse = {
        message: 'Si cette adresse email est enregistrée, le ou les identifiant(s) de connexion ont été envoyés.',
      };
      mockAuthService.recoverIdentifier.mockResolvedValue(neutralResponse);

      const result = await controller.recoverIdentifier({ email: 'test@example.com' }, '127.0.0.1');

      expect(result).toEqual(neutralResponse);
      expect(mockAuthService.recoverIdentifier).toHaveBeenCalledWith('test@example.com', '127.0.0.1');
    });
  });

  describe('POST /auth/forgot-password', () => {
    it('est un alias de requestPasswordReset', async () => {
      const neutralResponse = {
        message: 'Si cet identifiant est enregistré, un lien de réinitialisation a été envoyé.',
      };
      mockAuthService.requestPasswordReset.mockResolvedValue(neutralResponse);

      const result = await controller.forgotPassword({ loginIdentifier: 'test.user' }, '127.0.0.1');

      expect(result).toEqual(neutralResponse);
      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith('test.user', '127.0.0.1');
    });
  });

  describe('POST /auth/password-reset/request', () => {
    it('retourne message neutre pour un loginIdentifier connu (anti-énumération)', async () => {
      const neutralResponse = {
        message: 'Si cet identifiant est enregistré, un lien de réinitialisation a été envoyé.',
      };
      mockAuthService.requestPasswordReset.mockResolvedValue(neutralResponse);

      const result = await controller.requestPasswordReset({ loginIdentifier: 'test.user' }, '127.0.0.1');

      expect(result.message).toBeDefined();
      expect(mockAuthService.requestPasswordReset).toHaveBeenCalledWith('test.user', '127.0.0.1');
    });

    it('retourne le même message neutre pour un loginIdentifier inconnu (anti-énumération)', async () => {
      const neutralResponse = {
        message: 'Si cet identifiant est enregistré, un lien de réinitialisation a été envoyé.',
      };
      mockAuthService.requestPasswordReset.mockResolvedValue(neutralResponse);

      const result = await controller.requestPasswordReset({ loginIdentifier: 'unknown.user' }, '127.0.0.1');

      expect(result.message).toBeDefined();
    });
  });

  describe('POST /auth/reset-password', () => {
    it('appelle resetPassword avec le token et le nouveau mot de passe', async () => {
      const successResponse = { message: 'Mot de passe réinitialisé avec succès. Veuillez vous reconnecter.' };
      mockAuthService.resetPassword.mockResolvedValue(successResponse);

      const result = await controller.resetPassword({
        token: 'valid-reset-token',
        newPassword: 'NouveauMotDePasse123!',
      });

      expect(result).toEqual(successResponse);
      expect(mockAuthService.resetPassword).toHaveBeenCalledWith(
        'valid-reset-token',
        'NouveauMotDePasse123!',
      );
    });

    it('propage BadRequestException pour un token invalide', async () => {
      mockAuthService.resetPassword.mockRejectedValue(
        new BadRequestException('Token de réinitialisation invalide ou expiré.'),
      );

      await expect(
        controller.resetPassword({ token: 'bad-token', newPassword: 'newpass' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
