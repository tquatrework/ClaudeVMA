import { ArgumentsHost, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import { QUIZ_IMPORT_MAX_FILE_SIZE_BYTES } from './quiz-import.constants';

/**
 * Convertit le `PayloadTooLargeException` générique levé par multer
 * (`FileInterceptor`, limite `fileSize`) en un corps JSON structuré et un
 * message en français citant la taille reçue et la limite — même discipline
 * que `POST /profiles/:userId/avatar` (docs/routes.md, "Corps de la réponse
 * 413 — clés stables").
 *
 * `requestBodyBytes` reste une approximation DÉCLARÉE par le client
 * (`Content-Length`), jamais vérifiée : multer coupe le flux dès que la
 * limite est atteinte, la taille réelle du fichier n'est donc jamais connue
 * avec certitude dans ce cas (même limite documentée pour l'avatar :
 * `receivedBytes` vaut `null` quand multer a coupé le flux).
 */
@Catch(PayloadTooLargeException)
export class QuizImportPayloadTooLargeFilter implements ExceptionFilter {
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
      code: 'QUIZ_IMPORT_FILE_TOO_LARGE',
      message: 'Uploaded file exceeds the maximum allowed size',
      maxFileSizeBytes: QUIZ_IMPORT_MAX_FILE_SIZE_BYTES,
      requestBodyBytes,
    });
  }
}
