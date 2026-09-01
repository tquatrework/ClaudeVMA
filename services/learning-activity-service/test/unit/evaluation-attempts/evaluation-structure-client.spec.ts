/**
 * Unit tests — EvaluationStructureClientService
 *
 * Couvre l'appel vers la route publique de content-catalog-service
 * (GET /evaluations/:id) : appel nominal, en-têtes propagés, configuration
 * manquante, service injoignable, 404/401/403 amont, échec HTTP générique,
 * JSON illisible, réponse malformée (durationSeconds manquant/invalide,
 * exerciseItems manquant).
 */

import { ConfigService } from '@nestjs/config';
import {
  BadGatewayException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { EvaluationStructureClientService } from '../../../src/evaluation-attempts/evaluation-structure-client.service';

const EVALUATION_ID = 'ev-0000-4000-a000-aaaaaaaaaaaa';

function buildConfigService(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('EvaluationStructureClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('appelle content-catalog-service avec les bons en-têtes et renvoie la structure', async () => {
    const structure = {
      id: EVALUATION_ID,
      status: 'validated',
      durationSeconds: 1800,
      exerciseItems: [{ exerciseId: 'ex-1', order: 0 }],
    };

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(structure),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new EvaluationStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    const result = await client.getStructure(EVALUATION_ID, 'Bearer token-abc', 'corr-123');

    expect(result).toEqual(structure);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://content-catalog-service:3013/evaluations/${EVALUATION_ID}`,
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

  it('refuse si CONTENT_CATALOG_SERVICE_URL n\'est pas configuré', async () => {
    const client = new EvaluationStructureClientService(buildConfigService({}));

    await expect(client.getStructure(EVALUATION_ID, 'Bearer x')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('renvoie une 503 si content-catalog-service est injoignable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const client = new EvaluationStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EVALUATION_ID, 'Bearer x')).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('renvoie une 404 explicite si l\'évaluation est inconnue', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: jest.fn() }) as unknown as typeof fetch;

    const client = new EvaluationStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EVALUATION_ID, 'Bearer x')).rejects.toThrow(NotFoundException);
  });

  it.each([401, 403])('renvoie un accès refusé si content-catalog-service répond %s', async (status) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status, json: jest.fn() }) as unknown as typeof fetch;

    const client = new EvaluationStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EVALUATION_ID, 'Bearer x')).rejects.toThrow(ForbiddenException);
  });

  it('renvoie une 502 sur un échec HTTP générique', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: jest.fn() }) as unknown as typeof fetch;

    const client = new EvaluationStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EVALUATION_ID, 'Bearer x')).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si la réponse JSON est illisible', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    }) as unknown as typeof fetch;

    const client = new EvaluationStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EVALUATION_ID, 'Bearer x')).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si durationSeconds est manquant', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: EVALUATION_ID, status: 'validated', exerciseItems: [] }),
    }) as unknown as typeof fetch;

    const client = new EvaluationStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EVALUATION_ID, 'Bearer x')).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si durationSeconds est négatif ou nul', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        id: EVALUATION_ID,
        status: 'validated',
        durationSeconds: 0,
        exerciseItems: [],
      }),
    }) as unknown as typeof fetch;

    const client = new EvaluationStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EVALUATION_ID, 'Bearer x')).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si exerciseItems est manquant', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ id: EVALUATION_ID, status: 'validated', durationSeconds: 60 }),
    }) as unknown as typeof fetch;

    const client = new EvaluationStructureClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.getStructure(EVALUATION_ID, 'Bearer x')).rejects.toThrow(BadGatewayException);
  });
});
