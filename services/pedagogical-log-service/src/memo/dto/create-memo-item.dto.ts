import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  Min,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MemoItemType } from '../entities/memo-item.entity';

const ITEM_TYPES: MemoItemType[] = ['text', 'formula', 'image'];
const IMAGE_SIZE_LIMIT_KB = 500;

/**
 * DTO pour l'ajout d'un item dans un chapitre de mémo (élève uniquement).
 * XML spec functionality 004: formules mathématiques et images limitées en taille.
 */
export class CreateMemoItemDto {
  @ApiProperty({
    enum: ['text', 'formula', 'image'],
    description: 'Type d\'item: texte court, formule LaTeX, ou image (max 500 Ko)',
  })
  @IsIn(ITEM_TYPES)
  type: MemoItemType;

  @ApiProperty({
    description:
      'Contenu: texte libre, formule LaTeX (ex: $\\\\frac{a}{b}$), ou données image (base64/URL)',
  })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({
    description: `Taille de l'image en Ko (obligatoire si type=image, max ${IMAGE_SIZE_LIMIT_KB} Ko)`,
    maximum: IMAGE_SIZE_LIMIT_KB,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  sizeKb?: number;

  @ApiPropertyOptional({ description: 'Ordre d\'affichage dans le chapitre', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}

export { IMAGE_SIZE_LIMIT_KB };
