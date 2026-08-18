import { ConfigService } from '@nestjs/config';
import {
  IdentityAccessClient,
  IdentityAccessUnavailableError,
} from '../../../../src/common/clients/identity-access.client';

const IDENTITY_ACCESS_SERVICE_URL = 'http://identity-access-service:3001';
const INTERNAL_SECRET = 'internal-secret';

describe('IdentityAccessClient', () => {
  const originalFetch = global.fetch;
  let client: IdentityAccessClient;

  const buildConfigService = (): ConfigService =>
    ({
      get: (key: string, defaultValue?: string) => {
        if (key === 'IDENTITY_ACCESS_SERVICE_URL') return IDENTITY_ACCESS_SERVICE_URL;
        if (key === 'INTERNAL_SECRET') return INTERNAL_SECRET;
        return defaultValue;
      },
    }) as unknown as ConfigService;

  beforeEach(() => {
    client = new IdentityAccessClient(buildConfigService());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('resolveRole', () => {
    it('appelle la bonne URL avec le secret interne, et renvoie le rôle', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ userId: 'student-1', loginIdentifier: 'jean.dupont', role: 'eleve' }),
      }) as unknown as typeof fetch;

      const result = await client.resolveRole('student-1', 'corr-1');

      expect(result).toBe('eleve');
      expect(global.fetch).toHaveBeenCalledWith(
        `${IDENTITY_ACCESS_SERVICE_URL}/internal/accounts/by-user-id/student-1`,
        expect.objectContaining({
          method: 'GET',
          headers: {
            'X-Internal-Secret': INTERNAL_SECRET,
            'X-Correlation-Id': 'corr-1',
          },
        }),
      );
    });

    it("n'ajoute pas de header X-Correlation-Id quand aucun n'est fourni", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ userId: 'teacher-1', loginIdentifier: 'a.b', role: 'formateur' }),
      }) as unknown as typeof fetch;

      await client.resolveRole('teacher-1');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: { 'X-Internal-Secret': INTERNAL_SECRET } }),
      );
    });

    it('renvoie undefined sur 404 (compte inconnu), sans lever', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch;

      const result = await client.resolveRole('unknown-user');

      expect(result).toBeUndefined();
    });

    it('échoue fermé (IdentityAccessUnavailableError) sur une erreur réseau', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

      await expect(client.resolveRole('student-1')).rejects.toThrow(
        IdentityAccessUnavailableError,
      );
    });

    it('échoue fermé sur un timeout (AbortSignal.timeout)', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('The operation was aborted')) as unknown as typeof fetch;

      await expect(client.resolveRole('student-1')).rejects.toThrow(
        IdentityAccessUnavailableError,
      );
    });

    it('échoue fermé sur une réponse HTTP non-ok (ex. 401 secret invalide)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

      await expect(client.resolveRole('student-1')).rejects.toThrow(
        IdentityAccessUnavailableError,
      );
    });

    it('échoue fermé sur une réponse HTTP 500', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

      await expect(client.resolveRole('student-1')).rejects.toThrow(
        IdentityAccessUnavailableError,
      );
    });

    it("encode l'identifiant dans le chemin", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({ userId: 'a/b', loginIdentifier: 'x', role: 'eleve' }),
      }) as unknown as typeof fetch;

      await client.resolveRole('a/b');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/accounts/by-user-id/a%2Fb'),
        expect.anything(),
      );
    });
  });
});
