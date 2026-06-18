import { ApiProperty } from '@nestjs/swagger';

/**
 * Enveloppe de pagination générique.
 * Wrap les réponses de liste et de timeline.
 */
export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Éléments de la page courante' })
  data: T[];

  @ApiProperty({ description: 'Numéro de page courant', example: 1 })
  page: number;

  @ApiProperty({ description: 'Nombre d\'éléments par page', example: 20 })
  limit: number;

  @ApiProperty({ description: 'Nombre total d\'éléments', example: 42 })
  total: number;

  @ApiProperty({ description: 'Nombre total de pages', example: 3 })
  totalPages: number;
}
