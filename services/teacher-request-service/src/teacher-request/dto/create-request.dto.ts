import { IsString, IsOptional, IsUUID, IsNotEmpty, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Longueur maximale de la description, alignee sur un champ « texte long ». */
export const DESCRIPTION_MAX_LENGTH = 5000;

/**
 * Corps de `POST /requests`.
 *
 * UN SEUL champ de saisie : `description` (arbitrage du 2026-08-12, point 2).
 * `subject`, `level` et `sector` sont sortis du flow — le serveur s'aligne sur
 * l'ecran deja en ligne, qui fait autorite. Les envoyer provoque desormais un
 * `400` explicite (`forbidNonWhitelisted`) plutot qu'un silence.
 */
export class CreateRequestDto {
  @ApiProperty({
    description: "Texte libre decrivant le besoin. Seul champ de saisie de la demande.",
    example: "Je voudrais un professeur de mathematiques, plutot le mercredi soir.",
    maxLength: DESCRIPTION_MAX_LENGTH,
  })
  @IsString({ message: 'La description doit etre un texte.' })
  @IsNotEmpty({ message: 'La description est obligatoire.' })
  @MaxLength(DESCRIPTION_MAX_LENGTH, {
    message: `La description ne peut pas depasser ${DESCRIPTION_MAX_LENGTH} caracteres.`,
  })
  description: string;

  @ApiPropertyOptional({
    description:
      "Identifiant de l'eleve concerne. Obligatoire quand la demande n'est pas creee par l'eleve lui-meme.",
  })
  @IsOptional()
  @IsUUID('4', { message: "L'identifiant de l'eleve est invalide." })
  studentId?: string;
}
