import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InternalGuard } from '../../src/internal/internal.guard';

/** Crée un ExecutionContext simulé avec les headers fournis */
function buildMockExecutionContext(headers: Record<string, string | undefined>): ExecutionContext {
  const mockRequest = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
  } as unknown as ExecutionContext;
}

describe('InternalGuard', () => {
  let internalGuard: InternalGuard;
  let configGetMock: jest.Mock;

  beforeEach(async () => {
    configGetMock = jest.fn().mockReturnValue('super-secret-internal');
    // Reproduit le comportement réel de ConfigService.getOrThrow : lève une erreur
    // quand la valeur est undefined/null (le check de chaîne vide reste à la charge du guard).
    const configGetOrThrowMock = jest.fn((key: string) => {
      const value = configGetMock(key);
      if (value === undefined || value === null) {
        throw new Error(`Missing configuration key: ${key}`);
      }
      return value;
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InternalGuard,
        {
          provide: ConfigService,
          useValue: { get: configGetMock, getOrThrow: configGetOrThrowMock },
        },
      ],
    }).compile();

    internalGuard = module.get<InternalGuard>(InternalGuard);
  });

  describe('accès autorisé', () => {
    it('retourne true quand le header x-internal-secret correspond au secret configuré', () => {
      const executionContext = buildMockExecutionContext({
        'x-internal-secret': 'super-secret-internal',
      });

      const result = internalGuard.canActivate(executionContext);

      expect(result).toBe(true);
    });
  });

  describe('accès refusé — header manquant ou incorrect', () => {
    it('lève UnauthorizedException quand le header x-internal-secret est absent', () => {
      const executionContext = buildMockExecutionContext({});

      expect(() => internalGuard.canActivate(executionContext)).toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException quand le header contient une valeur incorrecte', () => {
      const executionContext = buildMockExecutionContext({
        'x-internal-secret': 'mauvais-secret',
      });

      expect(() => internalGuard.canActivate(executionContext)).toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException quand le header est une chaîne vide', () => {
      const executionContext = buildMockExecutionContext({
        'x-internal-secret': '',
      });

      expect(() => internalGuard.canActivate(executionContext)).toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException quand le header diffère de la casse', () => {
      const executionContext = buildMockExecutionContext({
        'x-internal-secret': 'SUPER-SECRET-INTERNAL',
      });

      expect(() => internalGuard.canActivate(executionContext)).toThrow(UnauthorizedException);
    });
  });

  describe('INTERNAL_SECRET non configuré', () => {
    it('lève UnauthorizedException (fail-closed) quand INTERNAL_SECRET est absent de la config', () => {
      configGetMock.mockReturnValue(undefined);

      const executionContext = buildMockExecutionContext({});

      expect(() => internalGuard.canActivate(executionContext)).toThrow(UnauthorizedException);
    });

    it('lève UnauthorizedException (fail-closed) quand INTERNAL_SECRET est une chaîne vide', () => {
      // Un secret vide est traité comme non configuré (falsy) — accès refusé par sécurité (S3).
      configGetMock.mockReturnValue('');

      const executionContext = buildMockExecutionContext({});

      expect(() => internalGuard.canActivate(executionContext)).toThrow(UnauthorizedException);
    });
  });
});
