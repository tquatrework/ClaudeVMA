import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO pour le renommage d'un chapitre de mémo (élève propriétaire uniquement).
 */
export class UpdateChapterDto {
  @ApiProperty({ description: 'Nouveau titre du chapitre', example: 'Géométrie' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;
}
