import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Contrat figé avec learning-activity-service (docs/architecture.md,
 * "Fonctionnalite Quizz", point 9). Ne pas renommer les champs sans mettre à
 * jour l'autre service en parallèle.
 */
export class GradeQuizAnswerDto {
  @ApiProperty({ description: 'UUID de la question répondue' })
  @IsUUID()
  questionId: string;

  @ApiPropertyOptional({
    description: 'Identifiants des options sélectionnées (single_choice / multiple_choice)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  @ApiPropertyOptional({ description: 'Texte saisi par l\'utilisateur (short_text)' })
  @IsOptional()
  @IsString()
  text?: string;
}

export class GradeQuizDto {
  @ApiProperty({ description: 'Réponses soumises pour ce quizz', type: [GradeQuizAnswerDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GradeQuizAnswerDto)
  answers: GradeQuizAnswerDto[];
}
