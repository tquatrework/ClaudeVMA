import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class CreateInternalNoteDto {
  @ApiProperty({
    description: 'Note content — visible only to RP and AdministrateurFinancier (PROF-FB-002)',
    example: 'L\'élève a rencontré des difficultés d\'assiduité en novembre.',
    maxLength: 5000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}
