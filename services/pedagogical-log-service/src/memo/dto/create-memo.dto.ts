import { IsString, IsNotEmpty, IsOptional, IsUUID, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateMemoDto {
  @ApiProperty({ description: 'Contenu du mémo (texte, formule, etc.)' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ description: 'Titre du mémo ou du chapitre' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'UUID de l\'activité concernée (lien contextuel pendant visio)' })
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiPropertyOptional({ description: 'UUID du chapitre de classement (nullable — mémo sans chapitre → catégorie "Général")' })
  @IsOptional()
  @IsUUID()
  chapterId?: string | null;
}
