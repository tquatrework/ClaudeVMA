import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  IsEnum,
  IsUrl,
  IsUUID,
  ArrayMaxSize,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TutorialFormat } from '../enums/tutorial-format.enum';
import { CreateTutorialBlockDto } from './create-tutorial-block.dto';
import {
  TUTORIAL_DESCRIPTION_MAX_LENGTH,
  TUTORIAL_MAX_BLOCKS,
  TUTORIAL_VIDEO_URL_MAX_LENGTH,
} from '../tutorial.constants';

export { CreateTutorialBlockDto } from './create-tutorial-block.dto';

/**
 * DTO de création d'un Tutoriel — refonte du 2026-09-03. `title` est
 * obligatoire, unique par auteur (disambiguation automatique par le
 * serveur, jamais un refus 400 sur collision — voir
 * `GET /tutorials/default-title` pour la valeur suggérée avant saisie, même
 * mécanisme exact que `Exercise`/`Quiz`/`Evaluation`).
 *
 * `format` détermine quels champs sont pertinents, vérifié côté service
 * (`TutorialsService.validateFormatConsistency`) plutôt qu'ici : `video`
 * exige `videoUrl` et interdit `blocks`, `post` exige l'absence de
 * `videoUrl` et accepte `blocks` (éventuellement vide, un post peut être
 * structuré librement).
 */
export class CreateTutorialDto {
  @ApiProperty({ description: 'Titre du tutoriel' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Description courte du tutoriel' })
  @IsOptional()
  @IsString()
  @MaxLength(TUTORIAL_DESCRIPTION_MAX_LENGTH)
  description?: string;

  @ApiPropertyOptional({ description: 'Thème mathématique (ex: algèbre, géométrie)' })
  @IsOptional()
  @IsString()
  theme?: string;

  @ApiPropertyOptional({ description: 'Tags pour la recherche', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Niveau scolaire ciblé (ex: seconde, terminale)' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ description: 'Difficulté (ex: facile, moyen, difficile)' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ description: 'Compétences travaillées', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  competencies?: string[];

  @ApiProperty({ enum: TutorialFormat, description: 'Format du tutoriel : vidéo embarquée ou post' })
  @IsEnum(TutorialFormat)
  format: TutorialFormat;

  @ApiPropertyOptional({
    description: "URL d'embedding de la vidéo — requise pour format=video, interdite pour format=post.",
    maxLength: TUTORIAL_VIDEO_URL_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @IsUrl({ require_protocol: true })
  @MaxLength(TUTORIAL_VIDEO_URL_MAX_LENGTH)
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'UUID du Quizz lié, affiché en fin de tuto (optionnel)' })
  @IsOptional()
  @IsUUID()
  linkedQuizId?: string;

  @ApiPropertyOptional({
    description:
      'Séquence ordonnée de blocs (texte/image) — pertinente uniquement pour format=post, ' +
      'interdite pour format=video. Un post peut être vide ou librement structuré.',
    type: [CreateTutorialBlockDto],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(TUTORIAL_MAX_BLOCKS)
  @ValidateNested({ each: true })
  @Type(() => CreateTutorialBlockDto)
  blocks?: CreateTutorialBlockDto[];
}
