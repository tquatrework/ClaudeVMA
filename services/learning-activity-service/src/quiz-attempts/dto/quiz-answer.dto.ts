import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class QuizAnswerDto {
  @ApiProperty({ description: 'Identifiant de la question (défini par content-catalog-service)' })
  @IsString()
  @IsNotEmpty()
  questionId: string;

  @ApiPropertyOptional({
    description: 'Identifiants des options sélectionnées (questions à choix unique ou multiples)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  selectedOptionIds?: string[];

  @ApiPropertyOptional({ description: 'Réponse texte libre (questions à texte court)' })
  @IsOptional()
  @IsString()
  text?: string;
}
