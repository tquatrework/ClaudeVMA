/**
 * Unit tests — ExerciseStructureClientService
 *
 * Couvre l'appel vers la route publique de content-catalog-service
 * (GET /exercises/:id) :
 *   - appel nominal, en-têtes propagés (Authorization forwarded, x-correlation-id)
 *   - configuration manquante (CONTENT_CATALOG_SERVICE_URL)
 *   - service injoignable (fetch rejette)
 *   - exerciseId inconnu côté content-catalog-service (404)
 *   - accès refusé côté content-catalog-service (401/403)
 *   - échec HTTP générique (5xx)
 *   - réponse JSON illisible
 *   - réponse malformée (champs manquants ou de mauvais type)
 */

import { ConfigService } from '@nestjs/config';
import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ExerciseStructureClientService } from '../../../src/exercise-attempts/exercise-structure-client.service';

const EXERCISE_ID = 'ex-0000-4000-a000-aaaaaaaaaaaa';

function buildConfigService(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('ExerciseStructureClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('appelle content-catalog-service avec les bons en-têtes et renvoie la structure', async () => {
    const structure = {
      id: EXERCISE_ID,
      parts: [
        { id: 'p1', category: 'statement' },
        { id: 'p2', category: 'question' },
      ],
    };

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(structure),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ExerciseStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    const result = await client.getStructure(EXERCISE_ID, 'Bearer token-abc', 'corr-123');

    expect(result).toEqual(structure);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://content-catalog-service:3013/exercises/${EXERCISE_ID}`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-abc',
          'x-correlation-id': 'corr-123',
        }),
      }),
    );
  });

  it('n\'ajoute pas d\'en-tête Authorization si aucun n\'est fourni', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: EXERCISE_ID, parts: [] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ExerciseStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await client.getStructure(EXERCISE_ID, undefined);

    const headersUsed = fetchMock.mock.calls[0][1].headers;
    expect(headersUsed.Authorization).toBeUndefined();
  });

  it('refuse si CONTENT_CATALOG_SERVICE_URL n\'est pas configuré', async () => {
    const client = new ExerciseStructureClientService(buildConfigService({}));

    await expect(client.getStructure(EXERCISE_ID, 'Bearer x')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('renvoie une 503 si content-catalog-service est injoignable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const client = new ExerciseStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EXERCISE_ID, 'Bearer x')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('renvoie une 404 explicite si l\'exercice est inconnu de content-catalog-service', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: jest.fn(),
    }) as unknown as typeof fetch;

    const client = new ExerciseStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EXERCISE_ID, 'Bearer x')).rejects.toThrow(NotFoundException);
  });

  it.each([401, 403])('renvoie un accès refusé si content-catalog-service répond %s', async (status) => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status,
      json: jest.fn(),
    }) as unknown as typeof fetch;

    const client = new ExerciseStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EXERCISE_ID, 'Bearer x')).rejects.toThrow(ForbiddenException);
  });

  it('renvoie une 502 sur un échec HTTP générique', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn(),
    }) as unknown as typeof fetch;

    const client = new ExerciseStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EXERCISE_ID, 'Bearer x')).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si la réponse JSON est illisible', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    }) as unknown as typeof fetch;

    const client = new ExerciseStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EXERCISE_ID, 'Bearer x')).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si la réponse est malformée (parts manquant)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: EXERCISE_ID }),
    }) as unknown as typeof fetch;

    const client = new ExerciseStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EXERCISE_ID, 'Bearer x')).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si une catégorie de bloc est invalide', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        id: EXERCISE_ID,
        parts: [{ id: 'p1', category: 'not-a-real-category' }],
      }),
    }) as unknown as typeof fetch;

    const client = new ExerciseStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EXERCISE_ID, 'Bearer x')).rejects.toThrow(BadGatewayException);
  });
});
