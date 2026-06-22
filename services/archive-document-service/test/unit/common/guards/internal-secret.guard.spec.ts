import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalSecretGuard } from '../../../../src/common/guards/internal-secret.guard';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildMockExecutionContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('InternalSecretGuard', () => {
  const EXPECTED_SECRET = 'super-secret-internal-key';

  let guard: InternalSecretGuard;
  let mockConfigService: { get: jest.Mock };

  beforeEach(() => {
    mockConfigService = {
      get: jest.fn().mockReturnValue(EXPECTED_SECRET),
    };

    guard = new InternalSecretGuard(mockConfigService as unknown as ConfigService);
  });

  // ADS-INT-001 — Requête sans X-Internal-Secret rejetée
  it('lève UnauthorizedException si le header X-Internal-Secret est absent', () => {
    const context = buildMockExecutionContext({});

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  // ADS-INT-002 — Requête avec secret invalide rejetée
  it('lève UnauthorizedException si le header X-Internal-Secret est incorrect', () => {
    const context = buildMockExecutionContext({
      'x-internal-secret': 'wrong-secret',
    });

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  // ADS-INT-003 — Requête avec secret valide autorisée
  it('retourne true quand le header X-Internal-Secret correspond au secret configuré', () => {
    const context = buildMockExecutionContext({
      'x-internal-secret': EXPECTED_SECRET,
    });

    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });
});
