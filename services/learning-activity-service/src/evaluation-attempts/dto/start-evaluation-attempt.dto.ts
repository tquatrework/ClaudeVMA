import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class StartEvaluationAttemptDto {
  @ApiProperty({ description: 'Identifiant de l\'Évaluation à démarrer (défini par content-catalog-service)' })
  @IsString()
  @IsNotEmpty()
  evaluationId: string;
}
