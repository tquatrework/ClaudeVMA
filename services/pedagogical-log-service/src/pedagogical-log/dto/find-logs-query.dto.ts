import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Filtre optionnel par date de séance pour GET /students/:studentId/pedagogical-log
 * — permet au front de se repositionner dans la liste.
 */
export class FindLogsQueryDto {
  @ApiPropertyOptional({ description: 'Date de séance minimale (ISO 8601)', example: '2026-08-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Date de séance maximale (ISO 8601)', example: '2026-08-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
