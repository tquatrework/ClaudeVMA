import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MEMO_CHAPTER_TITLE_MAX_LENGTH } from '../memo.constants';

/**
 * DTO pour le renommage d'un chapitre de mémo (élève propriétaire uniquement).
 * Mise à jour partielle — seuls les champs fournis changent.
 */
export class UpdateMemoChapterDto {
  @ApiPropertyOptional({
    description: 'Nouveau titre du chapitre',
    maxLength: MEMO_CHAPTER_TITLE_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MEMO_CHAPTER_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}
