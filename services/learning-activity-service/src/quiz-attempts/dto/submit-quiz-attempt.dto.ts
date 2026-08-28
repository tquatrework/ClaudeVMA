import { IsArray, ArrayMinSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { QuizAnswerDto } from './quiz-answer.dto';

export class SubmitQuizAttemptDto {
  @ApiProperty({
    description: 'Réponses soumises, une par question répondue',
    type: [QuizAnswerDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuizAnswerDto)
  answers: QuizAnswerDto[];
}
