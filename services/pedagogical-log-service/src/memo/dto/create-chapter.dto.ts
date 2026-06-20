import { IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO pour la création d'un chapitre de mémo (élève uniquement).
 * XML spec functionality 004: chapitres libres créés par l'élève.
 */
export class CreateChapterDto {
  @ApiProperty({ description: 'Titre du chapitre de mémo', example: 'Algèbre' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;
}
