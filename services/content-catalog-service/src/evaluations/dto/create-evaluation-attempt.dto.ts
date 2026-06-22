import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateEvaluationAttemptDto {
  @ApiPropertyOptional({ description: 'Clé d\'idempotence pour éviter les tentatives en double' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
