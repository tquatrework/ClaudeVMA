import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  TeacherValidationStatus,
  TEACHER_VALIDATION_STATUSES,
} from '../entities/teacher-validation.entity';

/**
 * Corps de `PATCH /profiles/:teacherId/validation`.
 *
 * `TeacherValidationStatus` est IMPORTÉ de l'entité et non redéclaré ici : ce
 * fichier en portait jusqu'au 2026-08-12 une copie littérale, donc deux
 * définitions d'une même donnée qui pouvaient diverger sans que rien ne le
 * signale (arbitrage du 2026-08-08, « un seul nom par donnée »). L'énumération
 * de validation vient de la même source, pour que le DTO ne puisse pas accepter
 * un statut que l'entité ignore.
 *
 * Messages en français : tout ce que l'utilisateur lit l'est (règle du
 * 2026-08-09), y compris les refus de validation d'un champ.
 */
export class UpdateTeacherValidationDto {
  @ApiProperty({
    description: 'Nouveau statut de validation du formateur',
    enum: TEACHER_VALIDATION_STATUSES,
    example: 'validated',
  })
  @IsEnum(TEACHER_VALIDATION_STATUSES, {
    message: `Le statut doit être l'un des suivants : ${TEACHER_VALIDATION_STATUSES.join(', ')}.`,
  })
  status: TeacherValidationStatus;

  @ApiPropertyOptional({
    description:
      'Commentaire libre : motif de refus, notes de validation. Facultatif, 2000 caractères ' +
      'au maximum.',
    example: "CV et expériences validés par le RP lors de l'entretien du 15/06.",
    maxLength: 2000,
  })
  @IsOptional()
  @IsString({ message: 'Le commentaire doit être du texte.' })
  @MaxLength(2000, {
    message: 'Le commentaire ne peut pas dépasser 2000 caractères.',
  })
  comment?: string;
}
