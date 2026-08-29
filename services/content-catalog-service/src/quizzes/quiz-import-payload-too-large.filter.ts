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
 *
 * `maxUploadBytes` est un ALIAS de `maxFileSizeBytes`, même valeur : le front
 * réutilise le composant générique de gestion d'erreur d'upload construit
 * pour l'avatar, qui lit `maxUploadBytes` en priorité (avec repli sur la
 * valeur lue depuis `GET /quizzes/import/constraints` sinon). Les deux clés
 * sont exposées pour que ce composant fonctionne sans adaptation, tout en
 * gardant `maxFileSizeBytes` comme nom canonique de cette fonctionnalité
 * (cohérent avec `GET /quizzes/import/constraints`). Réconciliation du
 * 2026-08-29 avec la PR front #176.
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
      maxUploadBytes: QUIZ_IMPORT_MAX_FILE_SIZE_BYTES,
      requestBodyBytes,
    });
  }
}
