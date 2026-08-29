/**
 * Unit tests — ExerciseSolutionClientService
 *
 * Contrat confirmé par content-catalog-service (PR #184) :
 *   - POST /internal/exercises/:exerciseId/parts/:partId/solution → 200
 *     { content: [{id, type, order, content, imageMimeType?, imageSizeBytes?}] }
 *     (champ `content`, pas `value` ; un seul comportement d'erreur, toujours
 *     404, jamais de 400 dédié — partId inexistant, bloc statement, ou bloc
 *     question sans solution).
 *   - GET /internal/exercises/images/:itemId → octets bruts (pas de base64).
 *
 * Couvre :
 *   - reveal() : appel nominal, en-têtes propagés (X-Internal-Secret,
 *     x-correlation-id), configuration manquante, service injoignable,
 *     404 (tous les cas confondus côté content-catalog-service), échec HTTP
 *     générique (5xx), réponse JSON illisible, réponse malformée
 *   - getImageBytes() : appel nominal, en-têtes propagés, configuration
 *     manquante, service injoignable, 404, échec HTTP générique
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
const ITEM_ID = 'item-0000-4000-c000-cccccccccccc';

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

  describe('reveal', () => {
    it('appelle content-catalog-service avec les bons en-têtes et renvoie la solution', async () => {
      const solutionResult = {
        content: [
          { id: 'i1', type: 'text', order: 0, content: 'x = 2' },
          { id: 'i2', type: 'image', order: 1, content: '', imageMimeType: 'image/png', imageSizeBytes: 12345 },
        ],
      };

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

    it(
      'renvoie une 404 explicite quel que soit le motif côté content-catalog-service ' +
        '(partId inexistant, bloc statement, ou bloc question sans solution — un seul comportement)',
      async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 404,
          json: jest.fn(),
        }) as unknown as typeof fetch;

        const client = new ExerciseSolutionClientService(
          buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
        );

        await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(NotFoundException);
      },
    );

    it('ne traite jamais un 400 comme un cas distinct (toujours 502 générique si jamais reçu)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: jest.fn(),
      }) as unknown as typeof fetch;

      const client = new ExerciseSolutionClientService(
        buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
      );

      await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(BadGatewayException);
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

    it('renvoie une 502 si un item utilise encore l\'ancien champ "value" au lieu de "content"', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{ id: 'i1', type: 'text', order: 0, value: 'x = 2' }],
        }),
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
        json: jest.fn().mockResolvedValue({
          content: [{ id: 'i1', type: 'audio', order: 0, content: 'x' }],
        }),
      }) as unknown as typeof fetch;

      const client = new ExerciseSolutionClientService(
        buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
      );

      await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(BadGatewayException);
    });

    it('renvoie une 502 si id ou order sont manquants sur un item', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({ content: [{ type: 'text', content: 'x = 2' }] }),
      }) as unknown as typeof fetch;

      const client = new ExerciseSolutionClientService(
        buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
      );

      await expect(client.reveal(EXERCISE_ID, PART_ID)).rejects.toThrow(BadGatewayException);
    });

    it('accepte un item sans imageMimeType/imageSizeBytes (texte/formule)', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: jest.fn().mockResolvedValue({
          content: [{ id: 'i1', type: 'formula', order: 0, content: 'x^2' }],
        }),
      }) as unknown as typeof fetch;

      const client = new ExerciseSolutionClientService(
        buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
      );

      await expect(client.reveal(EXERCISE_ID, PART_ID)).resolves.toEqual({
        content: [{ id: 'i1', type: 'formula', order: 0, content: 'x^2' }],
      });
    });
  });

  describe('getImageBytes', () => {
    it('appelle la route interne d\'image avec les bons en-têtes et renvoie les octets bruts', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: jest.fn().mockReturnValue('image/png') },
        arrayBuffer: jest.fn().mockResolvedValue(bytes.buffer),
      });
      global.fetch = fetchMock as unknown as typeof fetch;

      const client = new ExerciseSolutionClientService(
        buildConfigService({
          CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013',
          INTERNAL_SECRET: 'super-secret',
        }),
      );

      const result = await client.getImageBytes(ITEM_ID, 'corr-123');

      expect(result.contentType).toBe('image/png');
      expect(Buffer.compare(result.buffer, Buffer.from(bytes))).toBe(0);
      expect(fetchMock).toHaveBeenCalledWith(
        `http://content-catalog-service:3013/internal/exercises/images/${ITEM_ID}`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Internal-Secret': 'super-secret',
            'x-correlation-id': 'corr-123',
          }),
        }),
      );
    });

    it('retombe sur application/octet-stream si aucun Content-Type n\'est renvoyé', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: jest.fn().mockReturnValue(null) },
        arrayBuffer: jest.fn().mockResolvedValue(new Uint8Array([1]).buffer),
      }) as unknown as typeof fetch;

      const client = new ExerciseSolutionClientService(
        buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
      );

      const result = await client.getImageBytes(ITEM_ID);

      expect(result.contentType).toBe('application/octet-stream');
    });

    it('refuse si CONTENT_CATALOG_SERVICE_URL n\'est pas configuré', async () => {
      const client = new ExerciseSolutionClientService(buildConfigService({}));

      await expect(client.getImageBytes(ITEM_ID)).rejects.toThrow(ServiceUnavailableException);
    });

    it('renvoie une 503 si content-catalog-service est injoignable', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

      const client = new ExerciseSolutionClientService(
        buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
      );

      await expect(client.getImageBytes(ITEM_ID)).rejects.toThrow(ServiceUnavailableException);
    });

    it('renvoie une 404 explicite si l\'image est introuvable', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
      }) as unknown as typeof fetch;

      const client = new ExerciseSolutionClientService(
        buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
      );

      await expect(client.getImageBytes(ITEM_ID)).rejects.toThrow(NotFoundException);
    });

    it('renvoie une 502 sur un échec HTTP générique', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }) as unknown as typeof fetch;

      const client = new ExerciseSolutionClientService(
        buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
      );

      await expect(client.getImageBytes(ITEM_ID)).rejects.toThrow(BadGatewayException);
    });
  });
});
