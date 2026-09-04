/**
 * Unit tests — ProfileServiceClient
 *
 * Couvre l'arbitrage du 2026-09-04 ("Affichage de l'auteur de chaque
 * commentaire") : résolution par lot de prénom/nom auprès de profile-service,
 * avec dégradation gracieuse (Map vide, jamais une exception) sur tout échec
 * — réseau, timeout, HTTP non-2xx — pour ne jamais bloquer la lecture d'un
 * fil de discussion pour ce seul motif. Jamais de secours sur l'UUID en
 * revanche : une entrée absente reste absente de la Map, à charge de
 * l'appelant de traiter cela comme `authorName: null`.
 */

import { ConfigService } from '@nestjs/config';
import { ProfileServiceClient } from '../../../../src/common/clients/profile-service.client';

const ELEVE_ID = 'el-0000-4000-c000-cccccccccccc';
const FORMATEUR_ID = 'fo-0000-4000-d000-dddddddddddd';

function buildConfigService(values: Record<string, string>): ConfigService {
  return {
    getOrThrow: (key: string) => {
      if (values[key] === undefined) throw new Error(`Missing config key ${key}`);
      return values[key];
    },
  } as unknown as ConfigService;
}

describe('ProfileServiceClient', () => {
  let client: ProfileServiceClient;
  let fetchMock: jest.Mock;
  const originalFetch = global.fetch;

  beforeEach(() => {
    client = new ProfileServiceClient(
      buildConfigService({ PROFILE_SERVICE_URL: 'http://profile-service:3002', INTERNAL_SECRET: 'test-secret' }),
    );
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  describe('resolveDisplayNames()', () => {
    it('renvoie une Map vide sans appeler profile-service si la liste est vide', async () => {
      const result = await client.resolveDisplayNames([]);

      expect(result.size).toBe(0);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('appelle POST /internal/profiles/display-names avec les userIds dédupliqués', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          displayNames: [{ userId: ELEVE_ID, firstName: 'Camille', lastName: 'Durand' }],
        }),
      });

      await client.resolveDisplayNames([ELEVE_ID, ELEVE_ID]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('http://profile-service:3002/internal/profiles/display-names');
      expect(init.method).toBe('POST');
      expect(init.headers['X-Internal-Secret']).toBe('test-secret');
      expect(JSON.parse(init.body)).toEqual({ userIds: [ELEVE_ID] });
    });

    it('renvoie une Map indexée par userId à partir de la réponse', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          displayNames: [
            { userId: ELEVE_ID, firstName: 'Camille', lastName: 'Durand' },
            { userId: FORMATEUR_ID, firstName: 'Alex', lastName: 'Martin' },
          ],
        }),
      });

      const result = await client.resolveDisplayNames([ELEVE_ID, FORMATEUR_ID]);

      expect(result.get(ELEVE_ID)).toEqual({ firstName: 'Camille', lastName: 'Durand' });
      expect(result.get(FORMATEUR_ID)).toEqual({ firstName: 'Alex', lastName: 'Martin' });
      expect(result.size).toBe(2);
    });

    it('un userId absent de la réponse de profile-service est simplement absent de la Map', async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({ displayNames: [{ userId: ELEVE_ID, firstName: 'Camille', lastName: 'Durand' }] }),
      });

      const result = await client.resolveDisplayNames([ELEVE_ID, FORMATEUR_ID]);

      expect(result.has(FORMATEUR_ID)).toBe(false);
    });

    it('dégrade gracieusement (Map vide) sur une réponse HTTP non-2xx, sans lever', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500 });

      const result = await client.resolveDisplayNames([ELEVE_ID]);

      expect(result.size).toBe(0);
    });

    it('dégrade gracieusement (Map vide) sur une erreur réseau, sans lever', async () => {
      fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await client.resolveDisplayNames([ELEVE_ID]);

      expect(result.size).toBe(0);
    });

    it('dégrade gracieusement (Map vide) sur un timeout (AbortError), sans lever', async () => {
      fetchMock.mockRejectedValue(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));

      const result = await client.resolveDisplayNames([ELEVE_ID]);

      expect(result.size).toBe(0);
    });
  });
});
