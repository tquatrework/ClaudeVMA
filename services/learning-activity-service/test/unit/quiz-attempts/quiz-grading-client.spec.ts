/**
 * Unit tests — QuizGradingClientService
 *
 * Couvre l'appel interne vers content-catalog-service
 * (POST /internal/quizzes/:quizId/grade) :
 *   - appel nominal, en-têtes propagés (X-Internal-Secret, x-correlation-id)
 *   - configuration manquante (CONTENT_CATALOG_SERVICE_URL)
 *   - service injoignable (fetch rejette)
 *   - quizId inconnu côté content-catalog-service (404)
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
import { QuizGradingClientService } from '../../../src/quiz-attempts/quiz-grading-client.service';

const QUIZ_ID = 'quiz-0000-4000-a000-aaaaaaaaaaaa';

function buildConfigService(values: Record<string, string | undefined>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('QuizGradingClientService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('appelle content-catalog-service avec les bons en-têtes et renvoie le résultat', async () => {
    const gradingResult = {
      score: 3,
      maxScore: 5,
      details: [
        { questionId: 'q1', isCorrect: true, pointsEarned: 1, pointsPossible: 1 },
        { questionId: 'q2', isCorrect: false, pointsEarned: 0, pointsPossible: 1 },
      ],
    };

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(gradingResult),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new QuizGradingClientService(
      buildConfigService({
        CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013',
        INTERNAL_SECRET: 'super-secret',
      }),
    );

    const result = await client.grade(
      QUIZ_ID,
      [{ questionId: 'q1', selectedOptionIds: ['a'] }],
      'corr-123',
    );

    expect(result).toEqual(gradingResult);
    expect(fetchMock).toHaveBeenCalledWith(
      `http://content-catalog-service:3013/internal/quizzes/${QUIZ_ID}/grade`,
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
    const client = new QuizGradingClientService(buildConfigService({}));

    await expect(client.grade(QUIZ_ID, [])).rejects.toThrow(ServiceUnavailableException);
  });

  it('renvoie une 503 si content-catalog-service est injoignable', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) as unknown as typeof fetch;

    const client = new QuizGradingClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.grade(QUIZ_ID, [])).rejects.toThrow(ServiceUnavailableException);
  });

  it('renvoie une 404 explicite si le Quizz est inconnu de content-catalog-service', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: jest.fn(),
    }) as unknown as typeof fetch;

    const client = new QuizGradingClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.grade(QUIZ_ID, [])).rejects.toThrow(NotFoundException);
  });

  it('renvoie une 502 sur un échec HTTP générique', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: jest.fn(),
    }) as unknown as typeof fetch;

    const client = new QuizGradingClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.grade(QUIZ_ID, [])).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si la réponse JSON est illisible', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockRejectedValue(new Error('invalid json')),
    }) as unknown as typeof fetch;

    const client = new QuizGradingClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.grade(QUIZ_ID, [])).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si la réponse est malformée (champs manquants)', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ score: 3 }), // maxScore et details manquants
    }) as unknown as typeof fetch;

    const client = new QuizGradingClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.grade(QUIZ_ID, [])).rejects.toThrow(BadGatewayException);
  });

  it('renvoie une 502 si un détail de la réponse est de mauvais type', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        score: 1,
        maxScore: 2,
        details: [{ questionId: 'q1', isCorrect: 'oui', pointsEarned: 1, pointsPossible: 1 }],
      }),
    }) as unknown as typeof fetch;

    const client = new QuizGradingClientService(
      buildConfigService({ CONTENT_CATALOG_SERVICE_URL: 'http://content-catalog-service:3013' }),
    );

    await expect(client.grade(QUIZ_ID, [])).rejects.toThrow(BadGatewayException);
  });
});
