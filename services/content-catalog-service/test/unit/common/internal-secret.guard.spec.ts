/**
 * Unit tests — InternalSecretGuard
 *
 * Couvre :
 *   - refus fermé (401) si INTERNAL_SECRET n'est pas configuré
 *   - refus (401) si l'en-tête est absent ou invalide
 *   - passage si l'en-tête correspond au secret configuré
 */

import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalSecretGuard } from '../../../src/common/guards/internal-secret.guard';

function buildContext(headers: Record<string, string>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
  } as unknown as ExecutionContext;
}

function buildConfigService(secret: string | undefined): ConfigService {
  return { get: jest.fn().mockReturnValue(secret) } as unknown as ConfigService;
}

describe('InternalSecretGuard', () => {
  it('refuse tout appel si INTERNAL_SECRET n\'est pas configuré (échec fermé)', () => {
    const guard = new InternalSecretGuard(buildConfigService(undefined));

    expect(() => guard.canActivate(buildContext({ 'x-internal-secret': 'anything' }))).toThrow();
  });

  it('refuse un appel sans en-tête X-Internal-Secret', () => {
    const guard = new InternalSecretGuard(buildConfigService('super-secret'));

    expect(() => guard.canActivate(buildContext({}))).toThrow();
  });

  it('refuse un appel avec un en-tête invalide', () => {
    const guard = new InternalSecretGuard(buildConfigService('super-secret'));

    expect(() => guard.canActivate(buildContext({ 'x-internal-secret': 'wrong' }))).toThrow();
  });

  it('autorise un appel avec le bon secret', () => {
    const guard = new InternalSecretGuard(buildConfigService('super-secret'));

    expect(guard.canActivate(buildContext({ 'x-internal-secret': 'super-secret' }))).toBe(true);
  });
});
