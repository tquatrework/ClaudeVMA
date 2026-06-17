import { IsString, IsNotEmpty, IsOptional, IsNumber, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO pour la création d'un chapitre de mémo (élève uniquement).
 * XML spec functionality 004: chapitres libres créés par l'élève.
 */
export class CreateMemoChapterDto {
  @ApiProperty({ description: 'Titre du chapitre de mémo' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}
