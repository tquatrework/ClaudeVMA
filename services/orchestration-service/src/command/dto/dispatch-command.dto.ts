import { IsString, IsNotEmpty, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class DispatchCommandDto {
  @ApiProperty({ description: 'Service cible', example: 'profile-service' })
  @IsString()
  @IsNotEmpty()
  targetService: string;

  @ApiProperty({ description: 'Action à exécuter', example: 'create-student-profiles' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiProperty({ description: 'Données de la commande' })
  @IsObject()
  payload: Record<string, any>;

  @ApiProperty({ description: 'Clé d\'idempotence unique', example: 'cmd:abc123' })
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @ApiPropertyOptional({ description: 'correlationId pour le traçage' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}
