import { IsString, IsOptional, IsNumberString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MEMO_ITEM_CONTENT_MAX_LENGTH, MEMO_ITEM_TITLE_MAX_LENGTH } from '../memo.constants';

/**
 * Champs texte accompagnant l'envoi multipart d'une image de mémo
 * (`POST /memos/chapters/:chapterId/items/image`). `order` est validé comme
 * chaîne numérique (`@IsNumberString`) plutôt que `@IsNumber` : un champ
 * multipart arrive toujours en chaîne, et ce service n'active pas
 * `transform: true` dans son environnement de test e2e (contrairement à
 * `main.ts` en conditions réelles) — validé ici sans dépendre de la
 * transformation globale, converti explicitement côté service.
 */
export class CreateMemoImageItemDto {
  @ApiPropertyOptional({
    description: 'Légende optionnelle de l\'image',
    maxLength: MEMO_ITEM_CONTENT_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MEMO_ITEM_CONTENT_MAX_LENGTH)
  caption?: string;

  @ApiPropertyOptional({
    description: "Titre court, optionnel, affiché au-dessus de l'item",
    maxLength: MEMO_ITEM_TITLE_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MEMO_ITEM_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage dans le chapitre (chaîne numérique)' })
  @IsOptional()
  @IsNumberString()
  order?: string;
}
