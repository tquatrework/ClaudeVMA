import { Module } from '@nestjs/common';
import { FilesystemMediaStorageAdapter } from './filesystem-media-storage.adapter';
import { ImageTranscoder } from './image-transcoder';
import { MediaConfig } from './media.config';
import { MEDIA_STORAGE_PORT } from './media-storage.port';

/**
 * Stockage et traitement des médias binaires du service.
 *
 * Module technique, sans règle métier : il ne sait pas ce qu'est un profil ni
 * qui a le droit de voir quoi. Il expose un PORT (`MEDIA_STORAGE_PORT`) et son
 * adaptateur système de fichiers du jour. Le passage à un stockage objet
 * consistera à fournir un autre adaptateur derrière le même jeton — aucune
 * ligne à changer chez les appelants (voir `media-storage.port.ts`).
 */
@Module({
  providers: [
    MediaConfig,
    ImageTranscoder,
    { provide: MEDIA_STORAGE_PORT, useClass: FilesystemMediaStorageAdapter },
  ],
  exports: [MediaConfig, ImageTranscoder, MEDIA_STORAGE_PORT],
})
export class MediaModule {}
