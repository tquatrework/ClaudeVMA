import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import { dirname, join, resolve, sep } from 'path';
import { MediaConfig } from './media.config';
import { MediaObjectKey, MediaStoragePort } from './media-storage.port';

/**
 * Forme imposée d'une clé d'objet : `<dossier>/<uuid>.<extension>`.
 *
 * Volontairement close et sans point d'interrogation : pas de `..`, pas de
 * `/` en tête, pas de séparateur Windows, pas de caractère hors
 * `[a-z0-9-]`. Un `..` glissé dans une clé ferait écrire l'adaptateur hors du
 * volume — c'est la traversée de répertoire classique. Ici les clés sont
 * générées par le serveur, donc le motif ne devrait jamais échouer ; il est
 * contrôlé quand même, parce qu'une clé finit toujours par transiter par une
 * base de données, et qu'une base est une entrée comme une autre.
 */
const OBJECT_KEY_PATTERN = /^[a-z0-9][a-z0-9-]{0,31}\/[0-9a-f-]{36}\.[a-z0-9]{2,5}$/;

/**
 * Adaptateur système de fichiers du port de stockage des médias.
 *
 * Écrit sous `MEDIA_STORAGE_PATH`, monté sur le volume nommé `media_data`
 * (docker-compose.yml). Il est le SEUL endroit du service qui manipule un
 * chemin ; aucun chemin ne remonte au-delà, y compris dans les erreurs — voir
 * l'en-tête de `media-storage.port.ts`. Les chemins réels ne figurent que
 * dans les logs serveur.
 */
@Injectable()
export class FilesystemMediaStorageAdapter implements MediaStoragePort {
  private readonly logger = new Logger(FilesystemMediaStorageAdapter.name);
  private readonly rootPath: string;

  constructor(mediaConfig: MediaConfig) {
    this.rootPath = resolve(mediaConfig.storagePath);
  }

  /**
   * Écriture ATOMIQUE : les octets sont d'abord posés dans un fichier
   * temporaire voisin, puis `rename` bascule le nom définitif d'un seul coup.
   * Sans cela, un lecteur concurrent — ou un conteneur tué en plein `write` —
   * pourrait servir une image tronquée, que le navigateur afficherait à moitié
   * sans qu'aucune erreur ne soit levée nulle part.
   */
  async save(objectKey: MediaObjectKey, bytes: Buffer): Promise<void> {
    const targetPath = this.toAbsolutePath(objectKey);
    const temporaryPath = `${targetPath}.${randomUUID()}.part`;

    try {
      await fs.mkdir(dirname(targetPath), { recursive: true });
      await fs.writeFile(temporaryPath, bytes, { mode: 0o640 });
      await fs.rename(temporaryPath, targetPath);
    } catch (error) {
      await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
      throw this.opaqueFailure('écriture', objectKey, targetPath, error);
    }
  }

  /** `null` quand la clé n'existe pas : « absent » n'est pas une panne. */
  async read(objectKey: MediaObjectKey): Promise<Buffer | null> {
    const targetPath = this.toAbsolutePath(objectKey);
    try {
      return await fs.readFile(targetPath);
    } catch (error) {
      if (isFileNotFound(error)) return null;
      throw this.opaqueFailure('lecture', objectKey, targetPath, error);
    }
  }

  /** Idempotent : supprimer une clé déjà absente est un succès. */
  async delete(objectKey: MediaObjectKey): Promise<void> {
    const targetPath = this.toAbsolutePath(objectKey);
    try {
      await fs.rm(targetPath, { force: true });
    } catch (error) {
      throw this.opaqueFailure('suppression', objectKey, targetPath, error);
    }
  }

  /**
   * Traduit une clé d'objet en chemin absolu, sous double contrôle :
   * le motif d'abord, puis la vérification que le chemin résolu reste bien
   * SOUS la racine. La deuxième ceinture est délibérée — une expression
   * régulière peut être élargie un jour par inadvertance, la comparaison de
   * préfixe après `resolve()`, elle, ne se contourne pas.
   */
  private toAbsolutePath(objectKey: MediaObjectKey): string {
    assertValidObjectKey(objectKey);

    const absolutePath = resolve(join(this.rootPath, objectKey));
    if (absolutePath !== this.rootPath && !absolutePath.startsWith(this.rootPath + sep)) {
      this.logger.error(
        `Clé de média refusée : "${objectKey}" sort de la racine de stockage une fois résolue.`,
      );
      throw new InternalServerErrorException('Clé de média invalide');
    }
    return absolutePath;
  }

  /**
   * Journalise le détail (chemin compris) côté serveur, et ne renvoie à
   * l'appelant qu'un message sans chemin ni cause système.
   */
  private opaqueFailure(
    operation: string,
    objectKey: MediaObjectKey,
    targetPath: string,
    error: unknown,
  ): InternalServerErrorException {
    this.logger.error(
      `Échec de ${operation} du média objectKey="${objectKey}" (chemin=${targetPath}) : ` +
        `${error instanceof Error ? error.message : String(error)}`,
    );
    return new InternalServerErrorException(
      `Le stockage des médias n'a pas pu traiter cette opération (${operation})`,
    );
  }
}

/** Vrai pour un ENOENT, quelle que soit la façon dont Node l'a emballé. */
function isFileNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT';
}

/** Refuse toute clé hors motif — première ceinture contre la traversée. */
export function assertValidObjectKey(objectKey: MediaObjectKey): void {
  if (!OBJECT_KEY_PATTERN.test(objectKey)) {
    throw new InternalServerErrorException('Clé de média invalide');
  }
}

export { OBJECT_KEY_PATTERN };
