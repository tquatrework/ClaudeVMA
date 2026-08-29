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

/**
 * Champ nommé `content`, pas `value` — aligné sur le contrat confirmé par
 * content-catalog-service (PR #184) pour les items de blocs/solutions
 * (`GET /exercises/:id`, `POST /internal/exercises/:exerciseId/parts/:partId/solution`),
 * pour que le front puisse réutiliser le même rendu quelle que soit l'origine
 * de l'item (réponse soumise ou solution révélée).
 */
export class ExerciseContentItemDto {
  @ApiProperty({ enum: ExerciseContentItemType, description: 'Type de contenu' })
  @IsEnum(ExerciseContentItemType)
  type: ExerciseContentItemType;

  @ApiProperty({ description: 'Contenu (texte brut, LaTeX, ou légende d\'image selon le type)' })
  @IsString()
  @IsNotEmpty()
  content: string;
}
