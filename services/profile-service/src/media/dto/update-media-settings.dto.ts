import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';
import {
  MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES,
  MEDIA_SETTINGS_MIN_AVATAR_UPLOAD_BYTES,
} from '../entities/media-settings.entity';

/**
 * Corps de `PATCH /profiles/avatar/settings`.
 *
 * Messages en français : tout ce que l'utilisateur (ici le TI) lit l'est
 * (règle du 2026-08-09).
 */
export class UpdateMediaSettingsDto {
  @ApiProperty({
    type: Number,
    example: 2_000_000,
    description:
      'Nouveau plafond de taille du fichier envoyé pour la photo de profil, en octets. Doit ' +
      `rester entre ${MEDIA_SETTINGS_MIN_AVATAR_UPLOAD_BYTES} et ` +
      `${MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES} octets.`,
  })
  @IsInt({ message: 'maxAvatarUploadBytes doit être un nombre entier d’octets.' })
  @Min(MEDIA_SETTINGS_MIN_AVATAR_UPLOAD_BYTES, {
    message: `maxAvatarUploadBytes doit être d’au moins ${MEDIA_SETTINGS_MIN_AVATAR_UPLOAD_BYTES} octets — une valeur plus basse désactiverait la fonctionnalité sans le dire.`,
  })
  @Max(MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES, {
    message: `maxAvatarUploadBytes ne peut pas dépasser ${MEDIA_SETTINGS_MAX_AVATAR_UPLOAD_BYTES} octets.`,
  })
  maxAvatarUploadBytes: number;
}
