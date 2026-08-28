import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartQuizAttemptDto {
  @ApiProperty({ description: 'Identifiant du Quizz à démarrer (défini par content-catalog-service)' })
  @IsString()
  @IsNotEmpty()
  quizId: string;
}
