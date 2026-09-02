/**
 * Unit tests — ExerciseImportPayloadTooLargeFilter
 *
 * Vérifie le corps JSON structuré renvoyé pour un fichier d'import trop
 * volumineux (413), avec le code stable `EXERCISE_IMPORT_FILE_TOO_LARGE`, le
 * plafond en vigueur, et la taille déclarée par le client (`Content-Length`)
 * quand disponible — même discipline que `QuizImportPayloadTooLargeFilter`.
 */

import { ArgumentsHost, PayloadTooLargeException } from '@nestjs/common';
import { ExerciseImportPayloadTooLargeFilter } from '../../../src/exercises/exercise-import-payload-too-large.filter';
import { EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES } from '../../../src/exercises/exercise-import.constants';

function buildMockHost(headers: Record<string, string> = {}): { host: ArgumentsHost; response: any } {
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const request = { headers };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('ExerciseImportPayloadTooLargeFilter', () => {
  it('renvoie un 413 structuré avec le plafond en vigueur et la taille déclarée par le client', () => {
    const filter = new ExerciseImportPayloadTooLargeFilter();
    const { host, response } = buildMockHost({ 'content-length': '1258291' });

    filter.catch(new PayloadTooLargeException(), host);

    expect(response.status).toHaveBeenCalledWith(413);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 413,
        code: 'EXERCISE_IMPORT_FILE_TOO_LARGE',
        maxFileSizeBytes: EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES,
        maxUploadBytes: EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES,
        requestBodyBytes: 1258291,
      }),
    );
  });

  it('renvoie requestBodyBytes: null quand le client ne déclare pas Content-Length', () => {
    const filter = new ExerciseImportPayloadTooLargeFilter();
    const { host, response } = buildMockHost({});

    filter.catch(new PayloadTooLargeException(), host);

    expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ requestBodyBytes: null }));
  });
});
