import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MultipleChoiceScoringMode,
  QuizQuestionCategory,
  ShortTextScoringMode,
} from '../enums/quiz-question-category.enum';

export class CreateQuizQuestionOptionDto {
  @ApiPropertyOptional({ description: 'Identifiant de l\'option (généré si absent)' })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ description: 'Texte du choix proposé' })
  @IsString()
  @IsNotEmpty()
  text: string;

  @ApiProperty({ description: 'Ce choix fait-il partie de la solution ? (jamais renvoyé par une route publique)' })
  @IsBoolean()
  isCorrect: boolean;
}

export class CreateQuizQuestionDto {
  @ApiProperty({ enum: QuizQuestionCategory, description: 'Catégorie de la question' })
  @IsEnum(QuizQuestionCategory)
  category: QuizQuestionCategory;

  @ApiProperty({ description: 'Énoncé de la question' })
  @IsString()
  @IsNotEmpty()
  prompt: string;

  @ApiPropertyOptional({
    description: 'Choix proposés (requis pour single_choice et multiple_choice)',
    type: [CreateQuizQuestionOptionDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateQuizQuestionOptionDto)
  options?: CreateQuizQuestionOptionDto[];

  @ApiPropertyOptional({
    description: 'Mots-clés attendus, insensibles à la casse (requis pour short_text)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiPropertyOptional({
    enum: MultipleChoiceScoringMode,
    description: 'Mode de notation pour une question à choix multiples (défaut : all_or_nothing)',
  })
  @IsOptional()
  @IsEnum(MultipleChoiceScoringMode)
  multipleChoiceScoringMode?: MultipleChoiceScoringMode;

  @ApiPropertyOptional({
    enum: ShortTextScoringMode,
    description: 'Mode de notation pour une question à texte court (défaut : all_or_nothing)',
  })
  @IsOptional()
  @IsEnum(ShortTextScoringMode)
  shortTextScoringMode?: ShortTextScoringMode;

  @ApiPropertyOptional({ description: 'Barème individuel de la question, prévaut sur le barème global du quizz' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pointsOverride?: number;

  @ApiPropertyOptional({ description: 'Active/désactive la pénalité pour cette question uniquement, prévaut sur le réglage global du quizz' })
  @IsOptional()
  @IsBoolean()
  penaltyEnabledOverride?: boolean;

  @ApiPropertyOptional({ description: 'Points de pénalité individuels, prévaut sur le réglage global du quizz' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  penaltyPointsOverride?: number;
}
