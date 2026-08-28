import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateQuizQuestionDto } from './create-quiz-question.dto';

export class CreateQuizDto {
  @ApiProperty({ description: 'Titre du quizz' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiPropertyOptional({ description: 'Description courte du quizz' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Tags permettant de retrouver le quizz par recherche', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ description: 'Barème global : points par défaut par question (défaut : 1)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultPoints?: number;

  @ApiPropertyOptional({ description: 'Active une pénalité (note négative) en cas de réponse fausse, par défaut pour tout le quizz', default: false })
  @IsOptional()
  @IsBoolean()
  penaltyEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Points retirés par défaut en cas de réponse fausse, si penaltyEnabled est vrai' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  penaltyPoints?: number;

  @ApiProperty({ description: 'Questions du quizz', type: [CreateQuizQuestionDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateQuizQuestionDto)
  questions: CreateQuizQuestionDto[];
}
