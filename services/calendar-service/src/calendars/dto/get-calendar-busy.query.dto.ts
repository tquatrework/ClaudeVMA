import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

/**
 * Paramètres de requête de `GET /calendars/:ownerId/busy`.
 *
 * `from`/`to` sont des instants ISO 8601 avec fuseau (ex.
 * `2026-09-10T00:00:00Z`), exactement le même format que celui déjà exigé
 * par `startTime`/`endTime` sur les créneaux de disponibilité (point 1 de ce
 * chantier) — pas de nouveau format à retenir.
 */
export class GetCalendarBusyQueryDto {
  @ApiProperty({
    description: 'Début de la fenêtre demandée (ISO 8601, inclusif)',
    example: '2026-09-10T00:00:00Z',
  })
  @IsDateString()
  from: string;

  @ApiProperty({
    description: 'Fin de la fenêtre demandée (ISO 8601, exclusif)',
    example: '2026-09-17T00:00:00Z',
  })
  @IsDateString()
  to: string;
}
