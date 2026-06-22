import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateExerciseAnswerDto {
  @ApiProperty({ description: 'Contenu de la réponse de l\'élève' })
  @IsString()
  @IsNotEmpty()
  content: string;

  @ApiPropertyOptional({ description: 'Identifiant de la partie concernée (si exercice multi-parties)' })
  @IsOptional()
  @IsUUID()
  partId?: string;

  @ApiPropertyOptional({ description: 'Clé d\'idempotence pour éviter les doublons' })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
