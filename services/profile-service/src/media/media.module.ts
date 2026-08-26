import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FilesystemMediaStorageAdapter } from './filesystem-media-storage.adapter';
import { ImageTranscoder } from './image-transcoder';
import { MediaConfig } from './media.config';
import { MediaSettingsController } from './media-settings.controller';
import { MediaSettingsService } from './media-settings.service';
import { MediaSettings } from './entities/media-settings.entity';
import { MEDIA_STORAGE_PORT } from './media-storage.port';

/**
 * Stockage et traitement des médias binaires du service.
 *
 * Module TECHNIQUE pour l'essentiel : il ne sait pas ce qu'est un profil ni
 * qui a le droit de voir quoi. Il expose un PORT (`MEDIA_STORAGE_PORT`) et son
 * adaptateur système de fichiers du jour. Le passage à un stockage objet
 * consistera à fournir un autre adaptateur derrière le même jeton — aucune
 * ligne à changer chez les appelants (voir `media-storage.port.ts`).
 *
 * `MediaSettingsController` fait EXCEPTION à « aucune règle métier » : il
 * porte la seule règle de droit de ce module (écriture réservée au TI), parce
 * que la ressource qu'il expose (le plafond d'envoi) est strictement propre à
 * ce module technique — l'y laisser évite d'exporter `MediaSettingsService`
 * pour qu'un contrôleur de `ProfilesModule` le consomme depuis l'extérieur.
 */
@Module({
  imports: [TypeOrmModule.forFeature([MediaSettings])],
  controllers: [MediaSettingsController],
  providers: [
    MediaConfig,
    ImageTranscoder,
    MediaSettingsService,
    { provide: MEDIA_STORAGE_PORT, useClass: FilesystemMediaStorageAdapter },
  ],
  exports: [MediaConfig, ImageTranscoder, MediaSettingsService, MEDIA_STORAGE_PORT],
})
export class MediaModule {}
