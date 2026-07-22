import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from '../../src/auth/strategies/jwt.strategy';
import { User, UserRole, ValidationStatus } from '../../src/auth/entities/user.entity';
import { AccountsService } from '../../src/accounts/accounts.service';

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
  loginIdentifier: 'test.user',
  email: 'test@example.com',
  passwordHash: 'hashed',
  role: UserRole.ELEVE,
  validationStatus: ValidationStatus.ACTIVE,
  consentSigned: true,
  firstName: null,
  lastName: null,
  phone: null,
  isActive: true,
  emailVerified: false,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;
  let accountsService: { findActiveAccountById: jest.Mock };

  beforeEach(async () => {
    accountsService = {
      findActiveAccountById: jest.fn().mockResolvedValue(buildActiveUser()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: AccountsService,
          useValue: accountsService,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('test-jwt-secret'),
            getOrThrow: jest.fn().mockReturnValue('test-jwt-secret'),
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

    it('interroge AccountsService avec le sub du payload', async () => {
      const payload = buildValidPayload();
      await jwtStrategy.validate(payload as any);

      expect(accountsService.findActiveAccountById).toHaveBeenCalledWith('user-uuid-123');
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

    it('ne consulte pas AccountsService si le type est invalide', async () => {
      const refreshPayload = buildValidPayload({ type: 'refresh' });
      await expect(jwtStrategy.validate(refreshPayload as any)).rejects.toThrow(UnauthorizedException);
      expect(accountsService.findActiveAccountById).not.toHaveBeenCalled();
    });
  });

  describe('validate — user introuvable ou inactif', () => {
    it('lève UnauthorizedException quand le user est introuvable en base', async () => {
      accountsService.findActiveAccountById.mockResolvedValue(null);
      const payload = buildValidPayload();

      await expect(jwtStrategy.validate(payload as any)).rejects.toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException quand le user est inactif (isActive = false)', async () => {
      accountsService.findActiveAccountById.mockResolvedValue(buildActiveUser({ isActive: false }));
      const payload = buildValidPayload();

      await expect(jwtStrategy.validate(payload as any)).rejects.toThrow(UnauthorizedException);
    });

    it('ne retourne rien si le user est suspendu et inactif', async () => {
      accountsService.findActiveAccountById.mockResolvedValue(
        buildActiveUser({ isActive: false, validationStatus: ValidationStatus.SUSPENDED }),
      );
      const payload = buildValidPayload();

      await expect(jwtStrategy.validate(payload as any)).rejects.toThrow(UnauthorizedException);
    });
  });
});
