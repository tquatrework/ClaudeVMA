import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PROPOSAL_MESSAGE_MAX_LENGTH = 5000;
export const PROPOSAL_NOTE_MAX_LENGTH = 1000;
/** Nombre maximum de formateurs destinataires d'un meme envoi. */
export const PROPOSAL_MAX_RECIPIENTS = 50;

/**
 * Corps de `POST /requests/:requestId/proposals`.
 *
 * Le RP choisit SES formateurs (pluriel) et redige UN texte pour eux
 * (arbitrage du 2026-08-12, point 3), accompagne de trois champs indicatifs
 * optionnels. L'envoi est atomique : soit tous les formateurs recoivent la
 * proposition, soit aucun — un envoi par appel laissait un lot a moitie
 * distribue en cas d'echec.
 *
 * `message` (redige par le RP, lu par le formateur) et `description` (redigee
 * par l'eleve, portee par la demande) sont deux donnees distinctes : la regle
 * « un seul nom par donnee » n'est pas en cause.
 */
export class CreateProposalDto {
  @ApiProperty({
    description: 'Formateurs destinataires de la proposition.',
    type: [String],
    maxItems: PROPOSAL_MAX_RECIPIENTS,
  })
  @IsArray({ message: 'La liste des formateurs est invalide.' })
  @ArrayMinSize(1, { message: 'Choisissez au moins un formateur.' })
  @ArrayMaxSize(PROPOSAL_MAX_RECIPIENTS, {
    message: `Vous ne pouvez pas envoyer une proposition a plus de ${PROPOSAL_MAX_RECIPIENTS} formateurs a la fois.`,
  })
  @ArrayUnique({ message: 'Un meme formateur ne peut figurer qu\'une fois dans la liste.' })
  @IsUUID('4', { each: true, message: "L'identifiant d'un formateur est invalide." })
  teacherIds: string[];

  @ApiProperty({
    description: 'Texte redige par le RP a destination des formateurs.',
    maxLength: PROPOSAL_MESSAGE_MAX_LENGTH,
  })
  @IsString({ message: 'Le message doit etre un texte.' })
  @IsNotEmpty({ message: 'Le message a destination des formateurs est obligatoire.' })
  @MaxLength(PROPOSAL_MESSAGE_MAX_LENGTH, {
    message: `Le message ne peut pas depasser ${PROPOSAL_MESSAGE_MAX_LENGTH} caracteres.`,
  })
  message: string;

  @ApiPropertyOptional({ description: 'Creneaux possibles, en texte libre.' })
  @IsOptional()
  @IsString({ message: 'Les creneaux possibles doivent etre un texte.' })
  @MaxLength(PROPOSAL_NOTE_MAX_LENGTH, {
    message: `Les creneaux possibles ne peuvent pas depasser ${PROPOSAL_NOTE_MAX_LENGTH} caracteres.`,
  })
  availabilityNote?: string;

  @ApiPropertyOptional({ description: 'Remuneration envisagee, en texte libre.' })
  @IsOptional()
  @IsString({ message: 'La remuneration doit etre un texte.' })
  @MaxLength(PROPOSAL_NOTE_MAX_LENGTH, {
    message: `La remuneration ne peut pas depasser ${PROPOSAL_NOTE_MAX_LENGTH} caracteres.`,
  })
  compensationNote?: string;

  @ApiPropertyOptional({ description: 'Date limite de reponse souhaitee (AAAA-MM-JJ).', example: '2026-09-01' })
  @IsOptional()
  @IsDateString({}, { message: 'La date limite de reponse doit etre une date au format AAAA-MM-JJ.' })
  responseDeadline?: string;
}
