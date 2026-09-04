import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Décision RP sur un sujet en attente de validation — arbitrage du
 * 2026-09-04. `reason` est optionnel : aucun commentaire de refus n'est exigé
 * pour ce mécanisme simple (à la différence du flux de validation générique
 * de `content-catalog-service`, où le commentaire de refus est obligatoire).
 */
export class DecideForumTopicDto {
  @ApiProperty({ enum: ['validated', 'rejected'], description: 'Décision du RP' })
  @IsIn(['validated', 'rejected'])
  decision: 'validated' | 'rejected';

  @ApiPropertyOptional({ description: 'Motif de la décision (facultatif, surtout utile en cas de refus)' })
  @IsOptional()
  @IsString()
  reason?: string;
}
