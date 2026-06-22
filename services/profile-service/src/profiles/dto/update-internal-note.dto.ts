import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class UpdateInternalNoteDto {
  @ApiProperty({
    description: 'Updated note content — visible only to RP, AP, TI and AF (PROF-FB-002)',
    example: 'Mise à jour : l\'élève a retrouvé un rythme satisfaisant.',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
