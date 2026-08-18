import { ConfigService } from '@nestjs/config';
import {
  ProfileRelationsClient,
  ProfileRelationsUnavailableError,
} from '../../../../src/common/clients/profile-relations.client';
import { RelationKind } from '../../../../src/common/relations/relation-kind';

const PROFILE_SERVICE_URL = 'http://profile-service:3002';
const INTERNAL_SECRET = 'internal-secret';

describe('ProfileRelationsClient', () => {
  const originalFetch = global.fetch;
  let client: ProfileRelationsClient;

  const buildConfigService = (): ConfigService =>
    ({
      get: (key: string, defaultValue?: string) => {
        if (key === 'PROFILE_SERVICE_URL') return PROFILE_SERVICE_URL;
        if (key === 'INTERNAL_SECRET') return INTERNAL_SECRET;
        return defaultValue;
      },
    }) as unknown as ConfigService;

  beforeEach(() => {
    client = new ProfileRelationsClient(buildConfigService());
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('resolveRelations', () => {
    it('appelle la bonne URL avec le rôle et le secret interne, et renvoie le snapshot', async () => {
      const snapshot = {
        viewerId: 'teacher-1',
        targetId: 'student-1',
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.TEACHER_OF_STUDENT }],
      };
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(snapshot),
      }) as unknown as typeof fetch;

      const result = await client.resolveRelations(
        'teacher-1',
        'student-1',
        'formateur',
        'corr-1',
      );

      expect(result).toEqual(snapshot);
      expect(global.fetch).toHaveBeenCalledWith(
        `${PROFILE_SERVICE_URL}/internal/relations/teacher-1/student-1?viewerRole=formateur`,
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
        json: () =>
          Promise.resolve({
            viewerId: 'a',
            targetId: 'b',
            isSelf: false,
            isAdministrator: false,
            relations: [],
          }),
      }) as unknown as typeof fetch;

      await client.resolveRelations('a', 'b', 'eleve');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ headers: { 'X-Internal-Secret': INTERNAL_SECRET } }),
      );
    });

    it('échoue fermé (ProfileRelationsUnavailableError) sur une erreur réseau', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

      await expect(client.resolveRelations('a', 'b', 'eleve')).rejects.toThrow(
        ProfileRelationsUnavailableError,
      );
    });

    it('échoue fermé sur un timeout (AbortSignal.timeout)', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error('The operation was aborted')) as unknown as typeof fetch;

      await expect(client.resolveRelations('a', 'b', 'eleve')).rejects.toThrow(
        ProfileRelationsUnavailableError,
      );
    });

    it('échoue fermé sur une réponse HTTP non-ok (ex. 401 secret invalide)', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

      await expect(client.resolveRelations('a', 'b', 'eleve')).rejects.toThrow(
        ProfileRelationsUnavailableError,
      );
    });

    it('échoue fermé sur une réponse HTTP 500', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as unknown as typeof fetch;

      await expect(client.resolveRelations('a', 'b', 'eleve')).rejects.toThrow(
        ProfileRelationsUnavailableError,
      );
    });

    it('encode les identifiants dans le chemin', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            viewerId: 'a b',
            targetId: 'c/d',
            isSelf: false,
            isAdministrator: false,
            relations: [],
          }),
      }) as unknown as typeof fetch;

      await client.resolveRelations('a b', 'c/d', 'eleve');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/internal/relations/a%20b/c%2Fd?viewerRole=eleve'),
        expect.anything(),
      );
    });
  });
});
