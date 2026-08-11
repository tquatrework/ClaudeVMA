import { ConfigService } from '@nestjs/config';
import {
  ProfileRelationsClient,
  ProfileRelationsUnavailableError,
} from '../../../../src/common/clients/profile-relations.client';
import { RelationKind } from '../../../../src/common/relations/relation-kind';
import { UserRole } from '../../../../src/common/enums/user-role.enum';

const VIEWER_ID = 'viewer-uuid';
const TARGET_ID = 'target-uuid';

const configValues: Record<string, string> = {
  PROFILE_SERVICE_URL: 'http://profile-service:3002',
  INTERNAL_SECRET: 'secret-de-test',
};

const configService = {
  get: jest.fn((key: string, fallback?: string) => configValues[key] ?? fallback),
} as unknown as ConfigService;

describe('ProfileRelationsClient', () => {
  let client: ProfileRelationsClient;
  const fetchMock = jest.fn();

  beforeEach(() => {
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockReset();
    client = new ProfileRelationsClient(configService);
    jest.spyOn(client['logger'], 'error').mockImplementation(() => undefined);
  });

  it('appelle la route interne de profile-service avec le rôle en query obligatoire', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        viewerId: VIEWER_ID,
        targetId: TARGET_ID,
        isSelf: false,
        isAdministrator: false,
        relations: [{ kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: true }],
      }),
    });

    const snapshot = await client.resolveRelations(
      VIEWER_ID,
      TARGET_ID,
      UserRole.FORMATEUR,
      'correlation-abc',
    );

    expect(snapshot.relations).toEqual([
      { kind: RelationKind.TEACHER_OF_STUDENT, isPrincipalTeacher: true },
    ]);

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      `http://profile-service:3002/internal/relations/${VIEWER_ID}/${TARGET_ID}?viewerRole=formateur`,
    );
    expect(options.headers['X-Internal-Secret']).toBe('secret-de-test');
    expect(options.headers['X-Correlation-Id']).toBe('correlation-abc');
  });

  it('omet l\'en-tête de corrélation quand l\'appelant n\'en a pas', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ viewerId: VIEWER_ID, targetId: TARGET_ID, isSelf: false, isAdministrator: false, relations: [] }),
    });

    await client.resolveRelations(VIEWER_ID, TARGET_ID, UserRole.ELEVE);

    expect(fetchMock.mock.calls[0][1].headers['X-Correlation-Id']).toBeUndefined();
  });

  it('lève ProfileRelationsUnavailableError quand le réseau échoue ou expire', async () => {
    fetchMock.mockRejectedValue(new Error('timeout'));

    await expect(
      client.resolveRelations(VIEWER_ID, TARGET_ID, UserRole.FORMATEUR),
    ).rejects.toThrow(ProfileRelationsUnavailableError);
  });

  it.each([[400], [401], [500]])(
    'lève ProfileRelationsUnavailableError sur un statut %s — jamais un droit deviné',
    async (status) => {
      fetchMock.mockResolvedValue({ ok: false, status, json: async () => ({}) });

      await expect(
        client.resolveRelations(VIEWER_ID, TARGET_ID, UserRole.FORMATEUR),
      ).rejects.toThrow(ProfileRelationsUnavailableError);
    },
  );

  it('encode les identifiants dans l\'URL', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ viewerId: 'a b', targetId: TARGET_ID, isSelf: false, isAdministrator: false, relations: [] }),
    });

    await client.resolveRelations('a b', TARGET_ID, UserRole.ELEVE);

    expect(fetchMock.mock.calls[0][0]).toContain('/internal/relations/a%20b/');
  });
});
