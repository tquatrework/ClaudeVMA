import { ExecutionContext } from '@nestjs/common';
import { WebhookSecretGuard } from '../../../../src/common/guards/webhook-secret.guard';

const makeContext = (headerValue: string | undefined): ExecutionContext => {
  const request = {
    headers: headerValue !== undefined ? { 'x-webhook-secret': headerValue } : {},
  };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
};

describe('WebhookSecretGuard', () => {
  let guard: WebhookSecretGuard;
  const originalEnv = process.env.WEBHOOK_SECRET;

  beforeEach(() => {
    guard = new WebhookSecretGuard();
  });

  afterEach(() => {
    // Restore env var after each test
    if (originalEnv === undefined) {
      delete process.env.WEBHOOK_SECRET;
    } else {
      process.env.WEBHOOK_SECRET = originalEnv;
    }
  });

  describe('ORCH-WS-001 — header présent et correct', () => {
    it('retourne true quand le secret correspond à WEBHOOK_SECRET', () => {
      process.env.WEBHOOK_SECRET = 'my-shared-secret';
      const ctx = makeContext('my-shared-secret');
      expect(guard.canActivate(ctx)).toBe(true);
    });
  });

  describe('ORCH-WS-002 — header absent', () => {
    it('retourne false quand le header X-Webhook-Secret est absent', () => {
      process.env.WEBHOOK_SECRET = 'my-shared-secret';
      const ctx = makeContext(undefined);
      expect(guard.canActivate(ctx)).toBe(false);
    });
  });

  describe('ORCH-WS-003 — header incorrect', () => {
    it('retourne false quand le secret ne correspond pas', () => {
      process.env.WEBHOOK_SECRET = 'my-shared-secret';
      const ctx = makeContext('wrong-secret');
      expect(guard.canActivate(ctx)).toBe(false);
    });
  });

  describe('ORCH-WS-004 — WEBHOOK_SECRET non définie (fail-closed)', () => {
    it('retourne false quand WEBHOOK_SECRET est absente, même avec un header présent', () => {
      delete process.env.WEBHOOK_SECRET;
      const ctx = makeContext('any-value');
      expect(guard.canActivate(ctx)).toBe(false);
    });
  });
});
