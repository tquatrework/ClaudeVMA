import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User, UserRole, ValidationStatus } from './entities/user.entity';
import { LoginSession } from './entities/login-session.entity';
import * as bcrypt from 'bcryptjs';

const mockUser: User = {
  id: 'user-uuid',
  email: 'test@example.com',
  passwordHash: '',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.ACTIVE,
  consentSigned: true,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: any;
  let sessionRepo: any;
  let jwtService: JwtService;

  beforeEach(async () => {
    const hashedPw = await bcrypt.hash('password123', 10);
    const userWithHash = { ...mockUser, passwordHash: hashedPw };

    userRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(userWithHash),
      }),
      findOne: jest.fn().mockResolvedValue(mockUser),
      update: jest.fn().mockResolvedValue(undefined),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(LoginSession), useValue: sessionRepo },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('signed-token'),
            verify: jest.fn().mockReturnValue({ sub: 'user-uuid', jti: 'jti-uuid', type: 'refresh' }),
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('secret') } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('login', () => {
    it('returns token pair for valid credentials', async () => {
      const result = await service.login({ email: 'test@example.com', password: 'password123' });
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result.user.email).toBe('test@example.com');
    });

    it('throws 401 when user not found', async () => {
      userRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });
      await expect(service.login({ email: 'x@x.com', password: 'password123' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws 401 for wrong password', async () => {
      await expect(
        service.login({ email: 'test@example.com', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws 401 when account is inactive', async () => {
      userRepo.createQueryBuilder.mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({ ...mockUser, isActive: false }),
      });
      await expect(service.login({ email: 'test@example.com', password: 'password123' })).rejects.toThrow(
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
  });
});
