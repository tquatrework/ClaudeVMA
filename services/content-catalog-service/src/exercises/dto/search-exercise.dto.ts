import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class SearchExerciseDto {
  @ApiPropertyOptional({ description: 'Recherche par mot-clé dans le titre ou l\'énoncé' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ description: 'Filtrer par niveau scolaire' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: 'Filtrer par difficulté' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Filtrer par thème' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'Filtrer par tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Filtrer par auteur (id)' })
  @IsOptional()
  @IsString()
  authorId?: string;

  @ApiPropertyOptional({ description: 'Page courante (pagination)', default: 1 })
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
