import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';

export class ProposeSolutionDto {
  @ApiProperty({ description: 'Contenu de la solution proposée' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Coût en crédits pour accéder à cette solution' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost?: number;

  @ApiPropertyOptional({ description: 'Clé d\'idempotence pour éviter les doublons' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
