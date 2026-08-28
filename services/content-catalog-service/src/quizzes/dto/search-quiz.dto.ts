import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, IsNumber, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class SearchQuizDto {
  @ApiPropertyOptional({ description: 'Filtrer par tag' })
  @IsOptional()
  @IsString()
  tag?: string;

  @ApiPropertyOptional({ description: 'Recherche par mot-clé dans le titre' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({
    description:
      'Ne renvoyer que les quizz créés par l\'appelant, tous statuts confondus (y compris rejected). ' +
      'Remplace le filtre de visibilité par défaut : c\'est le point d\'entrée pour retrouver, éditer ' +
      'et resoumettre ses propres créations.',
    default: false,
  })
  @IsOptional()
  // `@Type(() => Boolean)` ne convient pas ici : `Boolean('false') === true`
  // en JS, ce qui accepterait `?mine=false` comme vrai. Comparaison textuelle
  // explicite, même précaution que pour les pièges de ValidationPipe déjà
  // documentés dans ce service (PendingValidationQueryDto).
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  mine?: boolean;

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
