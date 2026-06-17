import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateNotebookEntryDto {
  @ApiPropertyOptional({ description: 'Contenu de l\'entrée du carnet personnel' })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional({ description: 'Titre de l\'entrée' })
  @IsOptional()
  @IsString()
  title?: string;
}
