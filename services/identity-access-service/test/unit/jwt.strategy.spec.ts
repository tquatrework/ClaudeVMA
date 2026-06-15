import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { User, UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';

/** Minimal valid JWT payload matching JwtPayload interface */
const buildValidPayload = (overrides: Partial<Record<string, unknown>> = {}) => ({
  sub: 'user-uuid-123',
  email: 'test@example.com',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.ACTIVE,
  jti: 'jti-abc-123',
  type: 'access',
  ...overrides,
});

const buildActiveUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-uuid-123',
  email: 'test@example.com',
  passwordHash: 'hashed',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.ACTIVE,
  consentSigned: true,
  firstName: null,
  lastName: null,
  phone: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;
  let userRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn().mockResolvedValue(buildActiveUser()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: getRepositoryToken(User),
          useValue: userRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-jwt-secret'),
          },
        },
      ],
    }).compile();

    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate — payload valide', () => {
    it('retourne le user enrichi du jti pour un payload access valide', async () => {
      const payload = buildValidPayload();
      const result = await jwtStrategy.validate(payload as any);

      expect(result).toMatchObject({
        id: 'user-uuid-123',
        email: 'test@example.com',
        isActive: true,
        jti: 'jti-abc-123',
      });
    });

    it('interroge le repository avec le sub du payload', async () => {
      const payload = buildValidPayload();
      await jwtStrategy.validate(payload as any);

      expect(userRepo.findOne).toHaveBeenCalledWith({ where: { id: 'user-uuid-123' } });
    });

    it('propage le jti issu du payload dans le user retourné', async () => {
      const payload = buildValidPayload({ jti: 'specific-jti-value' });
      const result = await jwtStrategy.validate(payload as any);

      expect(result.jti).toBe('specific-jti-value');
    });
  });

  describe('validate — type de token incorrect', () => {
    it('lève UnauthorizedException si type !== "access"', async () => {
      const refreshPayload = buildValidPayload({ type: 'refresh' });
      await expect(jwtStrategy.validate(refreshPayload as any)).rejects.toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException si type est absent', async () => {
      const payloadWithoutType = buildValidPayload({ type: undefined });
      await expect(jwtStrategy.validate(payloadWithoutType as any)).rejects.toThrow(UnauthorizedException);
    });

    it('ne consulte pas le repository si le type est invalide', async () => {
      const refreshPayload = buildValidPayload({ type: 'refresh' });
      await expect(jwtStrategy.validate(refreshPayload as any)).rejects.toThrow(UnauthorizedException);
      expect(userRepo.findOne).not.toHaveBeenCalled();
    });
  });

  describe('validate — user introuvable ou inactif', () => {
    it('lève UnauthorizedException quand le user est introuvable en base', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const payload = buildValidPayload();

      await expect(jwtStrategy.validate(payload as any)).rejects.toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException quand le user est inactif (isActive = false)', async () => {
      userRepo.findOne.mockResolvedValue(buildActiveUser({ isActive: false }));
      const payload = buildValidPayload();

      await expect(jwtStrategy.validate(payload as any)).rejects.toThrow(UnauthorizedException);
    });

    it('ne retourne rien si le user est suspendu et inactif', async () => {
      userRepo.findOne.mockResolvedValue(
        buildActiveUser({ isActive: false, validationStatus: ValidationStatus.SUSPENDED }),
      );
      const payload = buildValidPayload();

      await expect(jwtStrategy.validate(payload as any)).rejects.toThrow(UnauthorizedException);
    });
  });
});
