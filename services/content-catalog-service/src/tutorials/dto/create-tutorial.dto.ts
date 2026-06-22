import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsUrl,
  IsUUID,
} from 'class-validator';
import { TutorialType, TutorialFormat } from '../../common/enums/content-type.enum';

export class CreateTutorialDto {
  @ApiProperty({ description: 'Titre du tutoriel' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Description courte' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TutorialType, description: 'Type de tutoriel : academie, activite, news' })
  @IsEnum(TutorialType)
  tutorialType: TutorialType;

  @ApiProperty({ enum: TutorialFormat, description: 'Format : texte, mixte, video' })
  @IsEnum(TutorialFormat)
  format: TutorialFormat;

  @ApiPropertyOptional({ description: 'Niveau scolaire ciblé' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: 'Thème mathématique' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'URL de l\'image d\'illustration' })
  @IsOptional()
  @IsString()
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'URL de la vidéo (pour format video ou mixte)' })
  @IsOptional()
  @IsString()
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Contenu texte (pour format texte ou mixte)' })
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional({ description: 'Tags pour la recherche', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Identifiants des ressources associées', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedResourceIds?: string[];

  @ApiPropertyOptional({ description: 'UUID de l\'évaluation associée' })
  @IsOptional()
  @IsUUID()
  relatedEvaluationId?: string;
}
