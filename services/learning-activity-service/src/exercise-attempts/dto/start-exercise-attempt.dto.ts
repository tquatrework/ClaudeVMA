import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartExerciseAttemptDto {
  @ApiProperty({ description: 'Identifiant de l\'Exercice à démarrer (défini par content-catalog-service)' })
  @IsString()
  @IsNotEmpty()
  exerciseId: string;
}
