import { PayloadTooLargeException } from '@nestjs/common';

/**
 * Code d'erreur STABLE du dépassement de taille.
 *
 * C'est cette clé — et non le texte de `message` — que le front doit tester
 * pour afficher son libellé français. Le message reste en anglais technique :
 * la règle de langue du 2026-08-09 veut que les noms de champs et de clés
 * d'API soient en anglais et que tout ce que l'utilisateur LIT soit porté côté
 * front, en un point unique. Un service qui renverrait ici une phrase française
 * imposerait sa formulation à tous les écrans et rendrait toute reformulation
 * impossible sans redéploiement du back.
 */
export const UPLOAD_FILE_TOO_LARGE_CODE = 'UPLOAD_FILE_TOO_LARGE';

/**
 * Corps de la réponse `413`.
 *
 * Trois nombres, trois significations distinctes — délibérément séparés plutôt
 * que fondus dans un seul champ approximatif :
 *
 *  • `maxUploadBytes` : le plafond appliqué, en octets, sur les octets du
 *    FICHIER (avant ré-encodage). Toujours présent. C'est la seule valeur dont
 *    le front a besoin pour composer sa phrase.
 *  • `receivedBytes` : la taille exacte du fichier reçu, quand elle est connue.
 *    Elle ne l'est QUE si le fichier a été lu en entier — c'est-à-dire quand le
 *    contrôle applicatif s'est déclenché après multer. Lorsque multer coupe le
 *    flux en cours de route, la valeur vaut `null` : le fichier n'a jamais été
 *    reçu en entier, annoncer une taille serait une invention.
 *  • `requestBodyBytes` : le `Content-Length` déclaré par le client pour le
 *    corps ENTIER de la requête, enveloppe multipart comprise. Toujours un peu
 *    supérieur à la taille du fichier, et absent si le client n'a rien déclaré.
 *
 * Le front connaît de toute façon `File.size` avant l'envoi : le champ vraiment
 * indispensable est `maxUploadBytes`, les deux autres servent au diagnostic et
 * aux journaux.
 */
export interface UploadFileTooLargeBody {
  statusCode: 413;
  error: 'Payload Too Large';
  code: typeof UPLOAD_FILE_TOO_LARGE_CODE;
  /** Anglais technique. Le libellé lu par l'utilisateur est construit côté front. */
  message: string;
  maxUploadBytes: number;
  receivedBytes: number | null;
  requestBodyBytes: number | null;
}

const UPLOAD_FILE_TOO_LARGE_MESSAGE = 'Uploaded file exceeds the maximum allowed size';

export interface UploadFileTooLargeDetails {
  maxUploadBytes: number;
  /** Taille exacte du fichier, ou `null` si le flux a été coupé avant la fin. */
  receivedBytes?: number | null;
  /** `Content-Length` de la requête entière, ou `null` s'il n'a pas été déclaré. */
  requestBodyBytes?: number | null;
}

/** Construit le corps `413`, forme unique quel que soit l'endroit du refus. */
export function buildUploadFileTooLargeBody(
  details: UploadFileTooLargeDetails,
): UploadFileTooLargeBody {
  return {
    statusCode: 413,
    error: 'Payload Too Large',
    code: UPLOAD_FILE_TOO_LARGE_CODE,
    message: UPLOAD_FILE_TOO_LARGE_MESSAGE,
    maxUploadBytes: details.maxUploadBytes,
    receivedBytes: details.receivedBytes ?? null,
    requestBodyBytes: details.requestBodyBytes ?? null,
  };
}

/**
 * Exception `413` portant le corps structuré.
 *
 * Passer un OBJET à `PayloadTooLargeException` remplace intégralement le corps
 * par défaut (`{statusCode, message, error}`) : c'est ce qui permet d'ajouter
 * `code`, `maxUploadBytes` et les tailles sans écrire de filtre pour ce
 * chemin-là.
 */
export function uploadFileTooLargeException(
  details: UploadFileTooLargeDetails,
): PayloadTooLargeException {
  return new PayloadTooLargeException(buildUploadFileTooLargeBody(details));
}

/**
 * Reconnaît un corps DÉJÀ structuré par ce module.
 *
 * Sert au filtre à ne pas réécrire — et donc à ne pas dégrader en perdant
 * `receivedBytes` — une exception que la couche métier a déjà renseignée.
 */
export function isUploadFileTooLargeBody(body: unknown): body is UploadFileTooLargeBody {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { code?: unknown }).code === UPLOAD_FILE_TOO_LARGE_CODE
  );
}
