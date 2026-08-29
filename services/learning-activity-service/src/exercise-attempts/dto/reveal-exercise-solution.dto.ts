import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RevealExerciseSolutionDto {
  @ApiProperty({ description: 'Identifiant du bloc question dont on révèle la solution' })
  @IsString()
  @IsNotEmpty()
  partId: string;
}
