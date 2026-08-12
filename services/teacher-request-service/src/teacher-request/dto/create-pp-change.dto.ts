import { IsUUID, IsOptional, IsString, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { DESCRIPTION_MAX_LENGTH } from './create-request.dto';

/**
 * Corps de `POST /requests/pp-change`.
 *
 * Aligne sur `CreateRequestDto` le 2026-08-12 : le texte du demandeur s'appelle
 * `description` ici comme la-bas — c'est la meme donnee, elle porte donc le
 * meme nom. `subject` n'est plus demande.
 */
export class CreatePpChangeDto {
  @ApiProperty({ description: "Eleve dont le professeur principal doit changer." })
  @IsUUID(undefined, { message: "L'identifiant de l'eleve est invalide." })
  studentId: string;

  @ApiPropertyOptional({ description: 'Professeur principal actuel, si le demandeur le connait.' })
  @IsOptional()
  @IsUUID(undefined, { message: "L'identifiant du professeur principal actuel est invalide." })
  currentPpTeacherId?: string;

  @ApiProperty({ description: 'Motif et contexte du changement demande.', maxLength: DESCRIPTION_MAX_LENGTH })
  @IsString({ message: 'La description doit etre un texte.' })
  @IsNotEmpty({ message: 'La description est obligatoire.' })
  @MaxLength(DESCRIPTION_MAX_LENGTH, {
    message: `La description ne peut pas depasser ${DESCRIPTION_MAX_LENGTH} caracteres.`,
  })
  description: string;
}
