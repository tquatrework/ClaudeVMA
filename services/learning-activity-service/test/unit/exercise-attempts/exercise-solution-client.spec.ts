/**
 * Unit tests — ExerciseSolutionClientService
 *
 * Couvre l'appel interne vers content-catalog-service
 * (POST /internal/exercises/:exerciseId/parts/:partId/solution) :
 *   - appel nominal, en-têtes propagés (X-Internal-Secret, x-correlation-id)
 *   - configuration manquante (CONTENT_CATALOG_SERVICE_URL)
 *   - service injoignable (fetch rejette)
 *   - solution introuvable (404)
 *   - échec HTTP générique (5xx)
 *   - réponse JSON illisible
 *   - réponse malformée (champs manquants ou de mauvais type)
 */

import { ConfigService } from '@nestjs/config';
import {
  BadGatewayException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ExerciseSolutionClientService } from '../../../src/exercise-attempts/exercise-solution-client.service';

const EXERCISE_ID = 'ex-0000-4000-a000-aaaaaaaaaaaa';
const PART_ID = 'part-0000-4000-b000-bbbbbbbbbbbb';

function buildConfigService(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('ExerciseSolutionClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('appelle content-catalog-service avec les bons en-têtes et renvoie la solution', async () => {
    const solutionResult = { content: [{ type: 'text', value: 'x = 2' }] };

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(solutionResult),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ExerciseSolutionClientService(
      buildConfigService({
        CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013',
        INTERNAL_SECRET: 'super-secret',
      }),
    );

    const result = await client.reveal(EXERCISE_ID, PART_ID, 'corr-123');

    expect(result).toEqual(solutionResult);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://content-catalog-service:3013/internal/exercises/${EXERCISE_ID}/parts/${PART_ID}/solution`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Internal-Secret': 'super-secret',
          'x-correlation-id': 'corr-123',
        }),
      }),
    );
  });

  it('refuse si CONTENT_CATALOG_SERVICE_URL n\'est pas configuré', async () => {
    const client = new ExerciseSolutionClientService(buildConfigService({}));

    await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(ServiceUnavailableException);
  });

  it('renvoie une 503 si content-catalog-service est injoignable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const client = new ExerciseSolutionClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(ServiceUnavailableException);
  });

  it('renvoie une 404 explicite si la solution est introuvable', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: jest.fn(),
    }) as unknown as typeof fetch;

    const client = new ExerciseSolutionClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(NotFoundException);
  });

  it('renvoie une 502 sur un échec HTTP générique', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn(),
    }) as unknown as typeof fetch;

    const client = new ExerciseSolutionClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si la réponse JSON est illisible', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    }) as unknown as typeof fetch;

    const client = new ExerciseSolutionClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si la réponse est malformée (content manquant)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({}),
    }) as unknown as typeof fetch;

    const client = new ExerciseSolutionClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si un item de contenu est de mauvais type', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ content: [{ type: 'audio', value: 'x' }] }),
    }) as unknown as typeof fetch;

    const client = new ExerciseSolutionClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(BadGatewayException);
  });
});
