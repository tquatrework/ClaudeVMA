import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Type d'un item de contenu, même mécanisme que le Memo
 * (docs/architecture.md > « Refonte des Exercices », point 2) :
 * texte brut, formule (LaTeX, rendue KaTeX au front) ou image (référence).
 */
export enum ExerciseContentItemType {
  TEXT = 'text',
  FORMULA = 'formula',
  IMAGE = 'image',
}

export class ExerciseContentItemDto {
  @ApiProperty({ enum: ExerciseContentItemType, description: 'Type de contenu' })
  @IsEnum(ExerciseContentItemType)
  type: ExerciseContentItemType;

  @ApiProperty({ description: 'Contenu (texte brut, LaTeX, ou référence d\'image selon le type)' })
  @IsString()
  @IsNotEmpty()
  value: string;
}
