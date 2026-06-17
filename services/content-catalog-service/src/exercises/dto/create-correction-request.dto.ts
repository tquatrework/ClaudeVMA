import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateCorrectionRequestDto {
  @ApiPropertyOptional({ description: 'Message optionnel pour le correcteur' })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: 'Clé d\'idempotence pour éviter les doublons' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
