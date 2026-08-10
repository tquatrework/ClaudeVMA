/**
 * PORT de stockage des médias binaires.
 *
 * Raison d'être : `profile-service` doit un jour pouvoir passer d'un volume
 * monté à un stockage objet (S3, MinIO — cf. « Stockage objet » dans
 * `docs/architecture.md`) SANS qu'un seul appelant ne bouge. C'est possible à
 * une condition, et une seule : que rien de ce qui est propre au système de
 * fichiers ne franchisse cette interface.
 *
 * D'où les deux règles tenues par tous les adaptateurs :
 *  1. l'unité d'échange est une CLÉ D'OBJET opaque (`avatars/<uuid>.webp`),
 *     jamais un chemin. L'adaptateur seul sait où cette clé atterrit ;
 *  2. AUCUN chemin de fichier ne sort du service — ni dans une réponse HTTP,
 *     ni dans un message d'erreur remonté à l'appelant. Le chemin réel n'a le
 *     droit d'apparaître que dans les logs serveur, où il sert au diagnostic.
 *
 * Corollaire : les erreurs levées ici sont volontairement pauvres en détail.
 * Un message d'erreur qui contiendrait `/app/storage/media/...` renseignerait
 * un attaquant sur l'arborescence du conteneur, et rendrait de surcroît le
 * message faux le jour du passage au stockage objet.
 */

/** Jeton d'injection du port — l'implémentation est choisie par MediaModule. */
export const MEDIA_STORAGE_PORT = Symbol('MEDIA_STORAGE_PORT');

/**
 * Clé d'objet : identifiant opaque d'un binaire stocké.
 *
 * Forme imposée `<dossier>/<uuid>.<extension>`, validée par
 * `assertValidObjectKey`. Le nom est TOUJOURS généré par le serveur : rien de
 * ce que l'appelant envoie (nom de fichier, extension, Content-Type) n'entre
 * dans sa composition.
 */
export type MediaObjectKey = string;

export interface MediaStoragePort {
  /**
   * Écrit les octets sous cette clé, en écrasant une éventuelle version
   * précédente. L'écriture doit être atomique du point de vue d'un lecteur
   * concurrent : on ne doit jamais pouvoir lire un fichier à moitié écrit.
   */
  save(objectKey: MediaObjectKey, bytes: Buffer): Promise<void>;

  /**
   * Relit les octets. `null` — et non une exception — quand la clé n'existe
   * pas : « absent » est une réponse légitime que l'appelant traduira en 404,
   * pas une panne.
   */
  read(objectKey: MediaObjectKey): Promise<Buffer | null>;

  /**
   * Supprime l'objet. Idempotent : supprimer une clé déjà absente est un
   * succès, l'état final visé étant atteint.
   */
  delete(objectKey: MediaObjectKey): Promise<void>;
}
