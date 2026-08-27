import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MEMO_CHAPTER_TITLE_MAX_LENGTH } from '../memo.constants';

/**
 * DTO pour la création d'un chapitre de mémo (élève uniquement).
 * XML spec functionality 004: chapitres libres créés par l'élève.
 */
export class CreateMemoChapterDto {
  @ApiProperty({
    description: 'Titre du chapitre de mémo',
    maxLength: MEMO_CHAPTER_TITLE_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MEMO_CHAPTER_TITLE_MAX_LENGTH)
  title: string;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}
