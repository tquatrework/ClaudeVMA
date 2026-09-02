import { ArgumentsHost, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import { EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES } from './exercise-import.constants';

/**
 * Convertit le `PayloadTooLargeException` générique levé par multer
 * (`FileInterceptor`, limite `fileSize`) en un corps JSON structuré — même
 * discipline que `QuizImportPayloadTooLargeFilter` (2026-08-29) et
 * `POST /profiles/:userId/avatar`.
 *
 * `requestBodyBytes` reste une approximation DÉCLARÉE par le client
 * (`Content-Length`), jamais vérifiée : multer coupe le flux dès que la
 * limite est atteinte.
 */
@Catch(PayloadTooLargeException)
export class ExerciseImportPayloadTooLargeFilter implements ExceptionFilter {
  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const contentLengthHeader = request?.headers?.['content-length'];
    const parsedContentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
    const requestBodyBytes = Number.isFinite(parsedContentLength) ? parsedContentLength : null;

    response.status(413).json({
      statusCode: 413,
      error: 'Payload Too Large',
      code: 'EXERCISE_IMPORT_FILE_TOO_LARGE',
      message: 'Uploaded file exceeds the maximum allowed size',
      maxFileSizeBytes: EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES,
      maxUploadBytes: EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES,
      requestBodyBytes,
    });
  }
}
