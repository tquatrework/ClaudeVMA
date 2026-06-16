import { IsString, IsNotEmpty, IsOptional, MinLength, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotebookEntryDto {
  @ApiProperty({ description: "Contenu de l'entrée du carnet personnel (texte libre, formules math)" })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ description: "Titre optionnel de l'entrée" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Date de l\'entrée (ISO 8601, ex: 2026-06-16). XML spec: "date".',
    example: '2026-06-16',
  })
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @ApiPropertyOptional({
    description:
      'UUID d\'un événement calendrier lié. XML spec PersonalNotebookEntry: "calendarEventId?".',
  })
  @IsOptional()
  @IsUUID()
  calendarEventId?: string;
}
