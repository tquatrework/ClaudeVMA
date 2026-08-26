import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl, MaxLength } from 'class-validator';

/**
 * Un lien externe libre attaché à une entrée de cahier de texte.
 *
 * Distinct de `LinkedResourceDto` (référence interne vers une ressource par
 * `{id, type}`, réservée à un usage phase 3 — content-catalog-service) : ici
 * `url` est un lien externe arbitraire saisi par le formateur, avec son
 * propre libellé affiché. Arbitrage du 2026-08-26, docs/architecture.md
 * "Liens et pièces jointes sur une entrée de cahier de texte", point 1.
 */
export class ResourceLinkDto {
  @ApiProperty({ description: 'Libellé affiché (jamais l\'URL brute affichée seule)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @ApiProperty({ description: 'URL absolue (http:// ou https://)' })
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  @MaxLength(2000)
  url: string;
}
