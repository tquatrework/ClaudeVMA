import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Actor } from '../common/types/actor.type';
import { MediaConfig } from './media.config';
import { MEDIA_SETTINGS_SINGLETON_ID, MediaSettings } from './entities/media-settings.entity';

/**
 * Réglage dynamique du plafond d'envoi de la photo de profil (arbitrage du
 * 2026-08-26, point 8).
 *
 * SOURCE DE VÉRITÉ À L'EXÉCUTION. `MediaConfig.maxUploadBytes` (lu depuis
 * `MEDIA_MAX_UPLOAD_BYTES`, variable d'environnement figée au démarrage) ne
 * sert plus qu'à AMORCER la ligne unique de `media_settings` au tout premier
 * appel — jamais comme valeur appliquée directement.
 */
@Injectable()
export class MediaSettingsService {
  private readonly logger = new Logger(MediaSettingsService.name);

  constructor(
    @InjectRepository(MediaSettings)
    private readonly repo: Repository<MediaSettings>,
    private readonly mediaConfig: MediaConfig,
  ) {}

  /**
   * Plafond courant, en octets. Lu par :
   *  - `GET /profiles/avatar/constraints` (tout compte authentifié) ;
   *  - `AvatarService.uploadAvatar`, second verrou après celui — statique —
   *    de multer.
   */
  async getMaxAvatarUploadBytes(): Promise<number> {
    const settings = await this.getOrBootstrapSettings();
    return settings.maxAvatarUploadBytes;
  }

  /**
   * Pose un nouveau plafond. Les bornes (entier positif, « raisonnable »,
   * `[MEDIA_SETTINGS_MIN_AVATAR_UPLOAD_BYTES, MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES]`)
   * sont déjà vérifiées par `UpdateMediaSettingsDto` avant d'arriver ici :
   * cette méthode ne revalide pas, elle écrit.
   *
   * Réservée au TI côté contrôleur (`@Roles(TECHNICIEN_INFORMATIQUE)`) — ce
   * service ne revérifie pas le rôle, il fait confiance à l'appelant HTTP,
   * comme le reste de ce service technique (MediaModule « ne connaît aucune
   * règle métier »).
   */
  async updateMaxAvatarUploadBytes(maxAvatarUploadBytes: number, actor: Actor): Promise<MediaSettings> {
    const settings = await this.getOrBootstrapSettings();
    settings.maxAvatarUploadBytes = maxAvatarUploadBytes;
    settings.updatedBy = actor.id;
    return this.repo.save(settings);
  }

  /**
   * Lit la ligne singleton, ou l'AMORCE si elle n'existe pas encore.
   *
   * Ce n'est PAS une exception à la règle « une lecture n'écrit jamais en
   * base » (arbitrage du 2026-08-07, posé pour `GET /profiles/:userId`) :
   * cette règle protège contre le masquage silencieux d'une incohérence de
   * données sur une entité qui appartient à un utilisateur. Ici, la ligne
   * unique de `media_settings` n'a AUCUN état « normal sans ligne » distinct
   * de son état amorcé — l'amorçage EST la donnée par défaut, explicitement
   * voulu par l'arbitrage (« valeur d'amorçage à la première lecture »).
   *
   * CONCURRENCE : deux premières lectures simultanées peuvent tenter
   * l'amorçage en même temps. La contrainte de clé primaire sur `id` fait
   * échouer la seconde ; elle relit alors la ligne que la première vient de
   * créer, plutôt que de faire échouer la requête de l'utilisateur.
   */
  private async getOrBootstrapSettings(): Promise<MediaSettings> {
    const existing = await this.repo.findOne({ where: { id: MEDIA_SETTINGS_SINGLETON_ID } });
    if (existing) return existing;

    const bootstrapped = this.repo.create({
      id: MEDIA_SETTINGS_SINGLETON_ID,
      maxAvatarUploadBytes: this.mediaConfig.maxUploadBytes,
      updatedBy: null,
    });

    try {
      return await this.repo.save(bootstrapped);
    } catch (error) {
      if (!(error instanceof QueryFailedError)) throw error;

      const racedBySimultaneousBootstrap = await this.repo.findOne({
        where: { id: MEDIA_SETTINGS_SINGLETON_ID },
      });
      if (racedBySimultaneousBootstrap) return racedBySimultaneousBootstrap;

      this.logger.error(
        `Échec de l'amorçage de media_settings sans ligne concurrente détectée : ${error.message}`,
      );
      throw error;
    }
  }
}
