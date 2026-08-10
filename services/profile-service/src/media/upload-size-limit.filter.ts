import { ArgumentsHost, Catch, ExceptionFilter, PayloadTooLargeException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { maxUploadBytesFromEnvironment } from './media.config';
import {
  buildUploadFileTooLargeBody,
  isUploadFileTooLargeBody,
  UploadFileTooLargeBody,
} from './upload-size-limit';

/**
 * Donne au `413` de multer un corps exploitable par le front.
 *
 * Quand multer atteint `limits.fileSize`, il coupe le flux et lève
 * `LIMIT_FILE_SIZE` ; `@nestjs/platform-express` le traduit en
 * `PayloadTooLargeException('File too large')`, dont le corps se réduit à
 * `{statusCode, message: "File too large", error}`. Ni la limite, ni la taille
 * reçue : le front ne peut qu'écrire « trop lourd » sans dire de combien, ou
 * pire, recopier en dur un plafond qui divergera du serveur au premier
 * changement. Ce filtre remplace ce corps par la forme unique définie dans
 * `upload-size-limit.ts`.
 *
 * IL NE FAIT QUE REFORMATER. Le refus lui-même reste celui de multer, en
 * streaming : les octets excédentaires ne sont jamais chargés en mémoire.
 *
 * LA LIMITE EST RELUE À LA MÊME SOURCE QUE MULTER — `process.env`, via
 * `maxUploadBytesFromEnvironment()`, et non `MediaConfig`. Ce n'est pas un
 * raccourci pour éviter l'injection : le filtre doit annoncer le plafond
 * RÉELLEMENT APPLIQUÉ par le composant qui a refusé la requête. Les deux
 * sources coïncident en exploitation, et `MediaConfig` journalise un
 * avertissement au démarrage si jamais elles divergent.
 */
@Catch(PayloadTooLargeException)
export class UploadSizeLimitFilter implements ExceptionFilter {
  catch(exception: PayloadTooLargeException, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const body = this.toStructuredBody(exception.getResponse(), request);
    response.status(413).json(body);
  }

  /**
   * Un corps déjà structuré par la couche métier passe TEL QUEL : il porte la
   * taille exacte du fichier, que ce filtre serait incapable de retrouver.
   */
  private toStructuredBody(
    existingBody: string | object,
    request: Request,
  ): UploadFileTooLargeBody {
    if (isUploadFileTooLargeBody(existingBody)) return existingBody;

    return buildUploadFileTooLargeBody({
      maxUploadBytes: maxUploadBytesFromEnvironment(),
      // Le flux a été coupé en cours de route : la taille du fichier n'a jamais
      // été connue. `null` le dit, plutôt que d'avancer un chiffre inventé.
      receivedBytes: null,
      requestBodyBytes: readContentLength(request),
    });
  }
}

/**
 * `Content-Length` déclaré par le client, ou `null`.
 *
 * Déclaré, donc pas vérifié : un client peut mentir ou ne rien envoyer (corps
 * en `chunked`). La valeur sert au diagnostic, jamais à décider — la décision
 * appartient à multer, qui compte les octets réellement lus.
 */
function readContentLength(request: Request | undefined): number | null {
  const raw = request?.headers?.['content-length'];
  if (typeof raw !== 'string') return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
