import { IsString, IsOptional, IsNumber, Min, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MEMO_ITEM_CONTENT_MAX_LENGTH, MEMO_ITEM_TITLE_MAX_LENGTH } from '../memo.constants';

/**
 * DTO de mise à jour d'un item de mémo (élève propriétaire uniquement).
 * Mise à jour partielle. Le type d'un item n'est jamais modifiable après
 * création (pas de champ `type` ici) — pour changer de type, supprimer puis
 * recréer.
 *
 * Pour un item `text`/`formula` : `content` porte le texte/la formule.
 * Pour un item `image` : `content` porte la légende optionnelle (jamais les
 * octets de l'image elle-même, qui ne se remplacent pas via cette route —
 * supprimer puis recréer l'item image).
 */
export class UpdateMemoItemDto {
  @ApiPropertyOptional({
    description: 'Nouveau contenu (texte/formule) ou nouvelle légende (image)',
    maxLength: MEMO_ITEM_CONTENT_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MEMO_ITEM_CONTENT_MAX_LENGTH)
  content?: string;

  @ApiPropertyOptional({
    description: "Nouveau titre court, affiché au-dessus de l'item",
    maxLength: MEMO_ITEM_TITLE_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MEMO_ITEM_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage dans le chapitre' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}
