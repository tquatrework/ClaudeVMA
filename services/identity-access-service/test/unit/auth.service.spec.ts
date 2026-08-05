import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { AuthService } from '../../src/auth/auth.service';
import { User, UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';
import { LoginSession } from '../../src/auth/entities/login-session.entity';
import { PasswordResetToken } from '../../src/auth/entities/password-reset-token.entity';
import { EmailVerificationToken } from '../../src/auth/entities/email-verification-token.entity';
import { IdentifierRecoveryToken } from '../../src/auth/entities/identifier-recovery-token.entity';
import { EventsService } from '../../src/events/events.service';
import { MailService } from '../../src/mail/mail.service';
import { AccountsService } from '../../src/accounts/accounts.service';
import * as bcrypt from 'bcryptjs';

const mockUser: User = {
  id: 'user-uuid',
  loginIdentifier: 'test.user',
  email: 'test@example.com',
  passwordHash: '',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.ACTIVE,
  consentSigned: true,
  isActive: true,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let accountsService: {
    findCredentialsByLoginIdentifier: jest.Mock;
    findActiveAccountById: jest.Mock;
    findAccountByEmail: jest.Mock;
    findAccountsByEmail: jest.Mock;
    findAccountByLoginIdentifier: jest.Mock;
    markEmailVerified: jest.Mock;
    updatePasswordHash: jest.Mock;
  };
  let sessionRepo: any;
  let resetTokenRepo: any;
  let emailVerifTokenRepo: any;
  let identifierRecoveryTokenRepo: any;
  let jwtService: JwtService;
  let mailService: any;

  beforeEach(async () => {
    const hashedPw = await bcrypt.hash('password123', 10);
    const userWithHash = { ...mockUser, passwordHash: hashedPw };

    accountsService = {
      findCredentialsByLoginIdentifier: jest.fn().mockResolvedValue(userWithHash),
      findActiveAccountById: jest.fn().mockResolvedValue(mockUser),
      findAccountByEmail: jest.fn().mockResolvedValue(mockUser),
      findAccountsByEmail: jest.fn().mockResolvedValue([mockUser]),
      findAccountByLoginIdentifier: jest.fn().mockResolvedValue(mockUser),
      markEmailVerified: jest.fn().mockResolvedValue(undefined),
      updatePasswordHash: jest.fn().mockResolvedValue(undefined),
    };

    sessionRepo = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockResolvedValue({ id: 'session-uuid', jwtId: 'jti-uuid' }),
      findOne: jest.fn().mockResolvedValue({
        id: 'session-uuid',
        jwtId: 'jti-uuid',
        revokedAt: null,
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    resetTokenRepo = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockResolvedValue({ id: 'token-uuid' }),
      findOne: jest.fn().mockResolvedValue({
        id: 'reset-token-uuid',
        userId: 'user-uuid',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60 * 60_000),
        usedAt: null,
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    emailVerifTokenRepo = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockResolvedValue({ id: 'email-token-uuid' }),
      findOne: jest.fn().mockResolvedValue({
        id: 'email-token-uuid',
        userId: 'user-uuid',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 1440 * 60_000),
        usedAt: null,
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };

    identifierRecoveryTokenRepo = {
      create: jest.fn().mockImplementation((entity) => entity),
      save: jest.fn().mockResolvedValue({ id: 'recovery-token-uuid' }),
    };

    mailService = {
      sendEmailVerification: jest.fn().mockResolvedValue(undefined),
      sendIdentifierRecovery: jest.fn().mockResolvedValue(undefined),
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(LoginSession), useValue: sessionRepo },
        { provide: getRepositoryToken(PasswordResetToken), useValue: resetTokenRepo },
        { provide: getRepositoryToken(EmailVerificationToken), useValue: emailVerifTokenRepo },
        { provide: getRepositoryToken(IdentifierRecoveryToken), useValue: identifierRecoveryTokenRepo },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-token'),
            verify: jest.fn().mockReturnValue({ sub: 'user-uuid', jti: 'jti-uuid', type: 'refresh' }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => defaultValue ?? 'secret'),
            getOrThrow: jest.fn((key: string) => 'secret'),
          },
        },
        { provide: EventsService, useValue: { publish: jest.fn() } },
        { provide: MailService, useValue: mailService },
        { provide: AccountsService, useValue: accountsService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('login', () => {
    it('returns token pair for valid credentials', async () => {
      const result = await service.login({ loginIdentifier: 'test.user', password: 'password123' });
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.loginIdentifier).toBe('test.user');
      expect(result.user.email).toBe('test@example.com');
      expect(accountsService.findCredentialsByLoginIdentifier).toHaveBeenCalledWith('test.user');
    });

    it('throws 401 when user not found', async () => {
      accountsService.findCredentialsByLoginIdentifier.mockResolvedValue(null);
      await expect(service.login({ loginIdentifier: 'unknown.user', password: 'password123' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 401 for wrong password', async () => {
      await expect(
        service.login({ loginIdentifier: 'test.user', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when account is inactive', async () => {
      const hashedPw = await bcrypt.hash('password123', 10);
      accountsService.findCredentialsByLoginIdentifier.mockResolvedValue({
        ...mockUser,
        passwordHash: hashedPw,
        isActive: false,
      });
      await expect(service.login({ loginIdentifier: 'test.user', password: 'password123' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('revokes session by jti', async () => {
      await service.logout('jti-uuid');
      expect(sessionRepo.update).toHaveBeenCalledWith(
        { jwtId: 'jti-uuid' },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });
  });

  describe('refresh', () => {
    it('issues new token pair for valid refresh token', async () => {
      const result = await service.refresh('valid-refresh-token');
      expect(result).toHaveProperty('access_token');
      expect(sessionRepo.update).toHaveBeenCalled();
      expect(accountsService.findActiveAccountById).toHaveBeenCalledWith('user-uuid');
    });

    it('throws 401 for invalid token type', async () => {
      jest.spyOn(jwtService, 'verify').mockReturnValue({ type: 'access', sub: 'uid', jti: 'j' } as any);
      await expect(service.refresh('bad-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when session is revoked', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-uuid',
        jwtId: 'jti-uuid',
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 86400_000),
      });
      await expect(service.refresh('any')).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when session is expired', async () => {
      sessionRepo.findOne.mockResolvedValue({
        id: 'session-uuid',
        jwtId: 'jti-uuid',
        revokedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });
      await expect(service.refresh('any')).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when account is no longer active', async () => {
      accountsService.findActiveAccountById.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.refresh('any')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('sendVerificationEmail', () => {
    it('envoie un email et crée un token quand le compte existe et n\'est pas vérifié', async () => {
      accountsService.findAccountByEmail.mockResolvedValue({ ...mockUser, emailVerified: false });
      const result = await service.sendVerificationEmail('test@example.com');
      expect(result.message).toBeDefined();
      expect(mailService.sendEmailVerification).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
      expect(emailVerifTokenRepo.save).toHaveBeenCalled();
    });

    it('ne fait rien si le compte n\'existe pas (réponse neutre)', async () => {
      accountsService.findAccountByEmail.mockResolvedValue(null);
      const result = await service.sendVerificationEmail('unknown@example.com');
      expect(result.message).toBeDefined();
      expect(mailService.sendEmailVerification).not.toHaveBeenCalled();
    });

    it('ne fait rien si l\'email est déjà vérifié (réponse neutre)', async () => {
      accountsService.findAccountByEmail.mockResolvedValue({ ...mockUser, emailVerified: true });
      const result = await service.sendVerificationEmail('test@example.com');
      expect(result.message).toBeDefined();
      expect(mailService.sendEmailVerification).not.toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('marque le compte comme vérifié et invalide le token', async () => {
      const result = await service.verifyEmail('valid-raw-token');
      expect(result.message).toContain('succès');
      expect(emailVerifTokenRepo.update).toHaveBeenCalledWith(
        'email-token-uuid',
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
      expect(accountsService.markEmailVerified).toHaveBeenCalledWith('user-uuid');
    });

    it('lance BadRequestException pour un token expiré', async () => {
      emailVerifTokenRepo.findOne.mockResolvedValue({
        id: 'email-token-uuid',
        userId: 'user-uuid',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      });
      await expect(service.verifyEmail('expired-token')).rejects.toThrow(BadRequestException);
    });

    it('lance BadRequestException pour un token déjà utilisé', async () => {
      emailVerifTokenRepo.findOne.mockResolvedValue({
        id: 'email-token-uuid',
        userId: 'user-uuid',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      });
      await expect(service.verifyEmail('used-token')).rejects.toThrow(BadRequestException);
    });

    it('lance BadRequestException si le token n\'existe pas', async () => {
      emailVerifTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyEmail('unknown-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('recoverIdentifier', () => {
    it('envoie les identifiants par email quand des comptes sont trouvés', async () => {
      accountsService.findAccountsByEmail.mockResolvedValue([mockUser]);
      const result = await service.recoverIdentifier('test@example.com');
      expect(result.message).toBeDefined();
      expect(mailService.sendIdentifierRecovery).toHaveBeenCalledWith(
        'test@example.com',
        ['test.user'],
      );
    });

    it('ne fait rien si aucun compte n\'est associé à l\'email (réponse neutre)', async () => {
      accountsService.findAccountsByEmail.mockResolvedValue([]);
      const result = await service.recoverIdentifier('unknown@example.com');
      expect(result.message).toBeDefined();
      expect(mailService.sendIdentifierRecovery).not.toHaveBeenCalled();
    });
  });

  describe('requestPasswordReset', () => {
    it('envoie un email de reset et crée un token quand l\'utilisateur existe', async () => {
      accountsService.findAccountByLoginIdentifier.mockResolvedValue(mockUser);
      const result = await service.requestPasswordReset('test.user');
      expect(result.message).toBeDefined();
      expect(mailService.sendPasswordReset).toHaveBeenCalledWith(
        'test@example.com',
        expect.any(String),
      );
      expect(resetTokenRepo.save).toHaveBeenCalled();
    });

    it('retourne la même réponse neutre si l\'identifiant n\'existe pas (anti-énumération)', async () => {
      accountsService.findAccountByLoginIdentifier.mockResolvedValue(null);
      const result = await service.requestPasswordReset('unknown.user');
      expect(result.message).toBeDefined();
      expect(mailService.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('réinitialise le mot de passe et révoque les sessions', async () => {
      const result = await service.resetPassword('valid-raw-token', 'NouveauMotDePasse123!');
      expect(result.message).toContain('succès');
      expect(resetTokenRepo.update).toHaveBeenCalledWith(
        'reset-token-uuid',
        expect.objectContaining({ usedAt: expect.any(Date) }),
      );
      expect(sessionRepo.update).toHaveBeenCalledWith(
        { userId: 'user-uuid' },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
      expect(accountsService.updatePasswordHash).toHaveBeenCalledWith(
        'user-uuid',
        expect.any(String),
      );
    });

    it('lance BadRequestException pour un token expiré', async () => {
      resetTokenRepo.findOne.mockResolvedValue({
        id: 'reset-token-uuid',
        userId: 'user-uuid',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      });
      await expect(service.resetPassword('expired-token', 'newpass')).rejects.toThrow(BadRequestException);
    });

    it('lance BadRequestException pour un token déjà utilisé', async () => {
      resetTokenRepo.findOne.mockResolvedValue({
        id: 'reset-token-uuid',
        userId: 'user-uuid',
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 60_000),
        usedAt: new Date(),
      });
      await expect(service.resetPassword('used-token', 'newpass')).rejects.toThrow(BadRequestException);
    });

    it('lance BadRequestException si le token n\'existe pas', async () => {
      resetTokenRepo.findOne.mockResolvedValue(null);
      await expect(service.resetPassword('unknown-token', 'newpass')).rejects.toThrow(BadRequestException);
    });
  });
});
