import { ConfigService } from '@nestjs/config';
import {
  ProfileDisplayNameClient,
  ProfileDisplayNameUnavailableError,
} from '../../../../src/common/clients/profile-display-name.client';

const PROFILE_SERVICE_URL = 'http://profile-service:3002';
const INTERNAL_SECRET = 'internal-secret';

describe('ProfileDisplayNameClient', () => {
  const originalFetch = global.fetch;
  let client: ProfileDisplayNameClient;

  const buildConfigService = (): ConfigService =>
    ({
      get: (key: string, defaultValue?: string) => {
        if (key === 'PROFILE_SERVICE_URL') return PROFILE_SERVICE_URL;
        if (key === 'INTERNAL_SECRET') return INTERNAL_SECRET;
        return defaultValue;
      },
    }) as unknown as ConfigService;

  beforeEach(() => {
    client = new ProfileDisplayNameClient(buildConfigService());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('resolveDisplayNames', () => {
    it('appelle la route en lot avec le secret interne, et renvoie une Map indexée par userId', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            displayNames: [
              { userId: 'teacher-1', firstName: 'Camille', lastName: 'Durand' },
              { userId: 'teacher-2', firstName: 'Alex', lastName: null },
            ],
          }),
      }) as unknown as typeof fetch;

      const result = await client.resolveDisplayNames(['teacher-1', 'teacher-2'], 'corr-1');

      expect(result.get('teacher-1')).toEqual({ firstName: 'Camille', lastName: 'Durand' });
      expect(result.get('teacher-2')).toEqual({ firstName: 'Alex', lastName: null });
      expect(global.fetch).toHaveBeenCalledWith(
        `${PROFILE_SERVICE_URL}/internal/profiles/display-names`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Internal-Secret': INTERNAL_SECRET,
            'X-Correlation-Id': 'corr-1',
          },
          body: JSON.stringify({ userIds: ['teacher-1', 'teacher-2'] }),
        }),
      );
    });

    it('déduplique les identifiants avant l\'appel', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ displayNames: [] }),
      }) as unknown as typeof fetch;

      await client.resolveDisplayNames(['teacher-1', 'teacher-1', 'teacher-2']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ body: JSON.stringify({ userIds: ['teacher-1', 'teacher-2'] }) }),
      );
    });

    it('un userId absent de la réponse en lot est simplement absent de la Map (jamais null inventé)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ displayNames: [] }),
      }) as unknown as typeof fetch;

      const result = await client.resolveDisplayNames(['ghost-user']);

      expect(result.has('ghost-user')).toBe(false);
      expect(result.size).toBe(0);
    });

    it('ne fait aucun appel réseau pour une liste vide', async () => {
      global.fetch = jest.fn();

      const result = await client.resolveDisplayNames([]);

      expect(result.size).toBe(0);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("n'ajoute pas de header X-Correlation-Id quand aucun n'est fourni", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ displayNames: [] }),
      }) as unknown as typeof fetch;

      await client.resolveDisplayNames(['teacher-1']);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: { 'Content-Type': 'application/json', 'X-Internal-Secret': INTERNAL_SECRET },
        }),
      );
    });

    it('échoue fermé (ProfileDisplayNameUnavailableError) sur une erreur réseau', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

      await expect(client.resolveDisplayNames(['teacher-1'])).rejects.toThrow(
        ProfileDisplayNameUnavailableError,
      );
    });

    it('échoue fermé sur une réponse HTTP non-ok (ex. 401 secret invalide)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

      await expect(client.resolveDisplayNames(['teacher-1'])).rejects.toThrow(
        ProfileDisplayNameUnavailableError,
      );
    });

    it('échoue fermé sur une réponse HTTP 500', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

      await expect(client.resolveDisplayNames(['teacher-1'])).rejects.toThrow(
        ProfileDisplayNameUnavailableError,
      );
    });
  });
});
