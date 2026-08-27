import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, IsIn, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemoItemType } from '../entities/memo-item.entity';
import { MEMO_ITEM_CONTENT_MAX_LENGTH, MEMO_ITEM_TITLE_MAX_LENGTH } from '../memo.constants';

/**
 * Types créables via cette route JSON — `image` est exclu : une image se
 * crée via la route multipart dédiée `POST .../items/image`
 * (`CreateMemoImageItemDto` implicite, voir `MemoController`), jamais via ce
 * DTO texte (chantier feat/memo-formules, B4 — "images: fichier séparé,
 * jamais base64 dans une colonne texte").
 */
const JSON_ITEM_TYPES: Array<Exclude<MemoItemType, 'image'>> = ['text', 'formula'];

/**
 * DTO pour l'ajout d'un item texte ou formule dans un chapitre de mémo
 * (élève uniquement). XML spec functionality 004.
 */
export class CreateMemoItemDto {
  @ApiProperty({
    enum: ['text', 'formula'],
    description:
      "Type d'item : texte court ou formule LaTeX. Pour une image, utiliser " +
      'POST /memos/chapters/:chapterId/items/image (multipart).',
  })
  @IsIn(JSON_ITEM_TYPES)
  type: Exclude<MemoItemType, 'image'>;

  @ApiProperty({
    description:
      'Contenu : texte libre, ou formule LaTeX (ex: $\\\\frac{a}{b}$)',
    maxLength: MEMO_ITEM_CONTENT_MAX_LENGTH,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MEMO_ITEM_CONTENT_MAX_LENGTH)
  content: string;

  @ApiPropertyOptional({
    description: "Titre court, optionnel, affiché au-dessus de l'item",
    maxLength: MEMO_ITEM_TITLE_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(MEMO_ITEM_TITLE_MAX_LENGTH)
  title?: string;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage dans le chapitre', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}
