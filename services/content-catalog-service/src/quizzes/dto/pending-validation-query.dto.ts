import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Paramètres de pagination de GET /quizzes/pending-validation.
 *
 * Passe par une DTO (comme SearchQuizDto pour GET /quizzes) plutôt que par
 * des `@Query('page') page?: number` individuels : sans DTO, le
 * ValidationPipe global (`transform: true`) applique `+value` à une query
 * absente lors de la conversion en Number, ce qui produit `NaN` — et non
 * `undefined` — et casse le calcul de pagination (`skip`/`take` NaN) côté
 * TypeORM avec un 500. Avec une DTO, un champ absent reste `undefined` et
 * les valeurs par défaut du service s'appliquent normalement.
 */
export class PendingValidationQueryDto {
  @ApiPropertyOptional({ description: 'Page courante', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Nombre d\'éléments par page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
