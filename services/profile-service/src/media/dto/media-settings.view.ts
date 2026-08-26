import { ApiProperty } from '@nestjs/swagger';
import { MediaSettings } from '../entities/media-settings.entity';

/**
 * Forme de réponse de `PATCH /profiles/avatar/settings`.
 *
 * Volontairement PLATE (pas d'enveloppe), comme les autres réponses
 * d'écriture de ce service (règle du 2026-08-10, point 3bis de
 * docs/architecture.md) : `{userId, ...champs}` ailleurs, ici
 * `{maxAvatarUploadBytes, updatedAt}` puisqu'il n'y a pas de titulaire.
 * `id` et `updatedBy` ne sont jamais exposés : le premier est un détail de
 * stockage interne (toujours la même valeur), le second un identifiant
 * technique qu'aucun rôle autre que l'AF n'a le droit de lire (règle du
 * 2026-08-09 sur les identifiants techniques) — hors de propos ici de toute
 * façon, seul le TI peut atteindre cette route.
 */
export class MediaSettingsView {
  @ApiProperty({ type: Number, example: 2_000_000 })
  maxAvatarUploadBytes: number;

  @ApiProperty({ type: String, example: '2026-08-26T10:00:00.000Z' })
  updatedAt: string;
}

export function toMediaSettingsView(settings: MediaSettings): MediaSettingsView {
  return {
    maxAvatarUploadBytes: settings.maxAvatarUploadBytes,
    updatedAt: settings.updatedAt.toISOString(),
  };
}
