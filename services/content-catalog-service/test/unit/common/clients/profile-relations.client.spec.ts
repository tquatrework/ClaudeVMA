/**
 * Unit tests — ProfileRelationsClient
 *
 * Couvre la vérification de la relation `animator_of_teacher` auprès de
 * profile-service (arbitrage du 2026-08-28, "Edition d'un Quizz par son
 * auteur... validation AP scopée par relation") :
 *   - relation présente / absente dans la réponse
 *   - cible inconnue de profile-service (404) → pas de relation, pas une panne
 *   - échec fermé (réseau, 5xx) → ServiceUnavailableException
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { ProfileRelationsClient } from '../../../../src/common/clients/profile-relations.client';

const VIEWER_ID = 'ap00-0000-4000-a000-aaaaaaaaaaaa';
const TARGET_ID = 'form-0000-4000-c000-cccccccccccc';

function buildConfigService(values: Record<string, string> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  };
}

function mockFetchResponse(status: number, body?: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('ProfileRelationsClient', () => {
  let client: ProfileRelationsClient;
  let originalFetch: typeof fetch;

  beforeEach(async () => {
    originalFetch = global.fetch;

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        ProfileRelationsClient,
        {
          provide: ConfigService,
          useValue: buildConfigService({
            PROFILE_SERVICE_URL: 'http://profile-service:3002',
            INTERNAL_SECRET: 'test-secret',
          }),
        },
      ],
    }).compile();

    client = moduleRef.get<ProfileRelationsClient>(ProfileRelationsClient);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('retourne vrai si la relation animator_of_teacher est présente', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockFetchResponse(200, { relations: [{ kind: 'animator_of_teacher' }] }),
    );

    const result = await client.hasAnimatorOfTeacherRelation(VIEWER_ID, TARGET_ID);

    expect(result).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith(
      `http://profile-service:3002/internal/relations/${VIEWER_ID}/${TARGET_ID}?viewerRole=animateur_pedagogique`,
      expect.objectContaining({
        method: 'GET',
        headers: { 'X-Internal-Secret': 'test-secret' },
      }),
    );
  });

  it('retourne faux si la relation est absente de la réponse', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockFetchResponse(200, { relations: [{ kind: 'finance_owner_student' }] }),
    );

    const result = await client.hasAnimatorOfTeacherRelation(VIEWER_ID, TARGET_ID);

    expect(result).toBe(false);
  });

  it('retourne faux si la liste de relations est vide', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockFetchResponse(200, { relations: [] }));

    const result = await client.hasAnimatorOfTeacherRelation(VIEWER_ID, TARGET_ID);

    expect(result).toBe(false);
  });

  it('retourne faux (pas une panne) si profile-service répond 404 (cible inconnue)', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockFetchResponse(404));

    const result = await client.hasAnimatorOfTeacherRelation(VIEWER_ID, TARGET_ID);

    expect(result).toBe(false);
  });

  it('lève ServiceUnavailableException si profile-service est injoignable (erreur réseau)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(client.hasAnimatorOfTeacherRelation(VIEWER_ID, TARGET_ID)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('lève ServiceUnavailableException si profile-service répond en erreur serveur', async () => {
    global.fetch = jest.fn().mockResolvedValue(mockFetchResponse(500));

    await expect(client.hasAnimatorOfTeacherRelation(VIEWER_ID, TARGET_ID)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });
});
