/**
 * Unit tests — ProfileRelationsClientService
 *
 * Couvre l'appel interne vers profile-service (contrat non confirmé, voir
 * commentaire du service et rapport de chantier) : appel nominal avec
 * X-Internal-Secret + x-correlation-id, configuration manquante, service
 * injoignable, 404 traité comme liste vide (pas une erreur), échec HTTP
 * générique, JSON illisible, réponse malformée.
 */

import { ConfigService } from '@nestjs/config';
import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { ProfileRelationsClientService } from '../../../src/evaluation-attempts/profile-relations-client.service';

const STUDENT_ID = 'el-0000-4000-c000-cccccccccccc';

function buildConfigService(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('ProfileRelationsClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('appelle profile-service avec les bons en-têtes et renvoie les teacherIds', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ teacherIds: ['t1', 't2'] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new ProfileRelationsClientService(
      buildConfigService({
        PROFILE_SERVICE_URL: 'http://profile-service:3002',
        INTERNAL_SECRET: 'shh',
      }),
    );

    const result = await client.getLinkedTeacherIds(STUDENT_ID, 'corr-123');

    expect(result).toEqual(['t1', 't2']);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://profile-service:3002/internal/relations/teachers/${STUDENT_ID}`,
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Internal-Secret': 'shh',
          'x-correlation-id': 'corr-123',
        }),
      }),
    );
  });

  it('refuse si PROFILE_SERVICE_URL n\'est pas configuré', async () => {
    const client = new ProfileRelationsClientService(buildConfigService({}));

    await expect(client.getLinkedTeacherIds(STUDENT_ID)).rejects.toThrow(ServiceUnavailableException);
  });

  it('renvoie une 503 si profile-service est injoignable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const client = new ProfileRelationsClientService(
      buildConfigService({ PROFILE_SERVICE_URL: 'http://profile-service:3002' }),
    );

    await expect(client.getLinkedTeacherIds(STUDENT_ID)).rejects.toThrow(ServiceUnavailableException);
  });

  it('traite un 404 amont comme une liste vide (pas une erreur)', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, json: jest.fn() }) as unknown as typeof fetch;

    const client = new ProfileRelationsClientService(
      buildConfigService({ PROFILE_SERVICE_URL: 'http://profile-service:3002' }),
    );

    await expect(client.getLinkedTeacherIds(STUDENT_ID)).resolves.toEqual([]);
  });

  it('renvoie une 502 sur un échec HTTP générique', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: jest.fn() }) as unknown as typeof fetch;

    const client = new ProfileRelationsClientService(
      buildConfigService({ PROFILE_SERVICE_URL: 'http://profile-service:3002' }),
    );

    await expect(client.getLinkedTeacherIds(STUDENT_ID)).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si la réponse JSON est illisible', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    }) as unknown as typeof fetch;

    const client = new ProfileRelationsClientService(
      buildConfigService({ PROFILE_SERVICE_URL: 'http://profile-service:3002' }),
    );

    await expect(client.getLinkedTeacherIds(STUDENT_ID)).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si la réponse est malformée (teacherIds absent)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({}),
    }) as unknown as typeof fetch;

    const client = new ProfileRelationsClientService(
      buildConfigService({ PROFILE_SERVICE_URL: 'http://profile-service:3002' }),
    );

    await expect(client.getLinkedTeacherIds(STUDENT_ID)).rejects.toThrow(BadGatewayException);
  });
});
