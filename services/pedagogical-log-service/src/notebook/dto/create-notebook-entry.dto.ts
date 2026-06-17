import { IsString, IsNotEmpty, IsOptional, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateNotebookEntryDto {
  @ApiProperty({ description: 'Contenu de l\'entrée du carnet personnel' })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  content: string;

  @ApiPropertyOptional({ description: 'Titre optionnel de l\'entrée' })
  @IsOptional()
  @IsString()
  title?: string;
}
