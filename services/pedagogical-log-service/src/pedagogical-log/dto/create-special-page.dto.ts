import {
  IsString,
  IsUUID,
  IsOptional,
  IsNotEmpty,
  MinLength,
  IsBoolean,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LinkedResourceDto } from './create-log.dto';

/**
 * DTO pour la création de pages spéciales (RP uniquement).
 * XML spec functionality 003: pages spéciales parent/financeur pouvant être invisibles à l'élève.
 */
export class CreateSpecialPageDto {
  @ApiProperty({ description: 'Contenu de la page spéciale (texte riche ou LaTeX)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({
    description:
      "Masquer cette page à l'élève. Si true, l'élève ne voit pas cette page dans son cahier. XML spec func 003.",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  hiddenFromStudent?: boolean;

  @ApiPropertyOptional({
    type: [LinkedResourceDto],
    description: 'Liens vers exercices, évaluations, tutos, parcours ou visios.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LinkedResourceDto)
  linkedResources?: Array<{ type: string; id: string; label?: string }>;

  @ApiPropertyOptional({ description: 'UUID de la session visio associée' })
  @IsOptional()
  @IsUUID()
  sessionId?: string;
}
