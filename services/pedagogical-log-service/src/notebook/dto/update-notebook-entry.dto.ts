import { IsString, IsOptional, IsDateString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotebookEntryDto {
  @ApiPropertyOptional({ description: "Contenu de l'entrée du carnet personnel" })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: "Titre de l'entrée" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Date de l\'entrée (ISO 8601)',
    example: '2026-06-16',
  })
  @IsOptional()
  @IsDateString()
  entryDate?: string;

  @ApiPropertyOptional({ description: 'UUID d\'un événement calendrier lié' })
  @IsOptional()
  @IsUUID()
  calendarEventId?: string;
}
