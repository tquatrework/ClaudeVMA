import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ExerciseContentItemType } from '../entities/exercise-content-item.entity';
import { EXERCISE_ITEM_CONTENT_MAX_LENGTH, EXERCISE_IMAGE_BASE64_MAX_LENGTH } from '../exercise.constants';

const JSON_ITEM_TYPES: ExerciseContentItemType[] = ['text', 'formula', 'image'];

/**
 * Item de contenu — texte, formule LaTeX, ou image encodée en base64.
 *
 * Arbitrage du 2026-09-01 ("Bloc 'image' de premier niveau pour l'Exercice") :
 * une image se dépose désormais dans le MÊME appel JSON que le reste de la
 * séquence de blocs, jamais via une route multipart séparée après coup
 * (l'ancien mécanisme post-création est retiré, pas conservé en parallèle).
 * Pour `type=image`, `imageData` porte les octets bruts en base64 (avec ou
 * sans préfixe data URI `data:image/...;base64,`), `content` devient une
 * légende optionnelle.
 *
 * Les règles structurelles croisées (content requis pour text/formula,
 * imageData requis pour image, un item image interdit hors d'un bloc dédié
 * de catégorie `image`) sont vérifiées côté service
 * (`ExercisesService.validatePartDto`/`buildItemEntities`), pas ici — même
 * discipline que le reste de ce fichier de DTO.
 */
export class CreateExerciseContentItemDto {
  @ApiProperty({
    enum: ['text', 'formula', 'image'],
    description: "Type d'item : texte court, formule LaTeX, ou image (octets en base64 dans imageData).",
  })
  @IsIn(JSON_ITEM_TYPES)
  type: ExerciseContentItemType;

  @ApiPropertyOptional({
    description:
      'Contenu : texte libre, ou formule LaTeX (ex: $\\frac{a}{b}$) — requis pour text/formula. ' +
      'Légende optionnelle pour une image.',
    maxLength: EXERCISE_ITEM_CONTENT_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(EXERCISE_ITEM_CONTENT_MAX_LENGTH)
  content?: string;

  @ApiPropertyOptional({
    description:
      "Octets de l'image, encodés en base64 (avec ou sans préfixe data URI) — requis pour type=image, " +
      'ignoré sinon.',
    maxLength: EXERCISE_IMAGE_BASE64_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(EXERCISE_IMAGE_BASE64_MAX_LENGTH)
  imageData?: string;

  @ApiPropertyOptional({
    description: "Nom de fichier d'origine fourni par le client — affichage uniquement, pour type=image.",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  imageOriginalFilename?: string;
}
