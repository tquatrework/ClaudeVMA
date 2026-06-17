import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsEnum, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { TutorialType, TutorialFormat } from '../../common/enums/content-type.enum';

export class SearchTutorialDto {
  @ApiPropertyOptional({ description: 'Recherche par mot-clé' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ enum: TutorialType, description: 'Filtrer par type de tutoriel' })
  @IsOptional()
  @IsEnum(TutorialType)
  tutorialType?: TutorialType;

  @ApiPropertyOptional({ enum: TutorialFormat, description: 'Filtrer par format' })
  @IsOptional()
  @IsEnum(TutorialFormat)
  format?: TutorialFormat;

  @ApiPropertyOptional({ description: 'Filtrer par niveau scolaire' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: 'Filtrer par thème' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'Filtrer par tag' })
  @IsOptional()
  @IsString()
  tag?: string;

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
