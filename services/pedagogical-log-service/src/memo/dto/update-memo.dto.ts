import { IsString, IsOptional, IsUUID, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMemoDto {
  @ApiPropertyOptional({ description: 'Contenu du mémo' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  content?: string;

  @ApiPropertyOptional({ description: 'Titre du mémo ou du chapitre' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'UUID de l\'activité concernée' })
  @IsOptional()
  @IsUUID()
  activityId?: string;
}
