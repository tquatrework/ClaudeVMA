import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const TERMINATION_REASON_MAX_LENGTH = 2000;

export class CreateTerminationDto {
  @ApiProperty({ description: 'Date de fin de preavis (AAAA-MM-JJ).', example: '2026-09-01' })
  @IsDateString({}, { message: 'La date de preavis doit etre une date au format AAAA-MM-JJ.' })
  noticeDate: string;

  @ApiPropertyOptional({ description: "Motif de l'arret." })
  @IsOptional()
  @IsString({ message: 'Le motif doit etre un texte.' })
  @MaxLength(TERMINATION_REASON_MAX_LENGTH, {
    message: `Le motif ne peut pas depasser ${TERMINATION_REASON_MAX_LENGTH} caracteres.`,
  })
  reason?: string;
}
