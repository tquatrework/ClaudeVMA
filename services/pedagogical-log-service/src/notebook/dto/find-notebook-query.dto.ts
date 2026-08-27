import { IsOptional, IsDateString, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Filtre de recherche optionnel pour GET /pedagogical-logs/notebook.
 *
 * Spécification fonctionnelle réelle du carnet personnel (docs/architecture.md,
 * arbitrage du 2026-08-27, "notes rapides immuables") : ce sont des pensées
 * instantanées horodatées automatiquement (`createdAt`), retrouvées par
 * RECHERCHE — pas par simple défilement d'une liste brute.
 *
 * `from` / `to` filtrent sur `createdAt` (seul horodatage de l'entrée, aucun
 * champ de date n'est saisi ni modifiable par l'utilisateur) — même
 * convention que `FindLogsQueryDto` du cahier de texte. Une date unique se
 * cherche en passant la même valeur aux deux bornes (`from=to=2026-08-27`).
 * `q` est une recherche texte libre, insensible à la casse, sur `content`.
 */
export class FindNotebookQueryDto {
  @ApiPropertyOptional({
    description:
      "Date minimale de création de l'entrée (ISO 8601). Pour une date précise, " +
      'utiliser la même valeur pour `from` et `to`.',
    example: '2026-08-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: "Date maximale de création de l'entrée (ISO 8601)",
    example: '2026-08-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: "Recherche texte libre, insensible à la casse, sur le contenu de l'entrée",
    example: 'dérivée',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  q?: string;
}
