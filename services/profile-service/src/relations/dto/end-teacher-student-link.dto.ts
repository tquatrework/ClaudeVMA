import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Plafond DÉCLARÉ du motif de fin. */
export const END_REASON_MAX_LENGTH = 1000;

/**
 * Corps — entièrement optionnel — de la fin d'une relation élève ↔ formateur.
 *
 * Le déclencheur est hors logiciel (arbitrage du 2026-08-12, point 2) : le RP
 * apprend par un appel, un courriel ou plus tard par la messagerie qu'il faut
 * arrêter. Il est donc le seul à pouvoir consigner POURQUOI, et ce champ est le
 * seul endroit du système où cette information peut exister.
 *
 * Le corps entier peut être omis : une fin sans motif est un cas normal, pas une
 * erreur. Exiger un motif produirait des motifs saisis pour la forme, qui valent
 * moins qu'un champ vide assumé.
 */
export class EndTeacherStudentLinkDto {
  @ApiPropertyOptional({
    description:
      "Motif de la fin de la relation, tel que le RP le consigne. Facultatif. " +
      `Plafond déclaré : ${END_REASON_MAX_LENGTH} caractères — un plafond non ` +
      'annoncé est un plafond caché (règle du 2026-08-10).',
    maxLength: END_REASON_MAX_LENGTH,
    example: "L'élève a demandé un nouveau professeur.",
  })
  @IsOptional()
  @IsString({ message: 'Le motif doit être un texte.' })
  @MaxLength(END_REASON_MAX_LENGTH, {
    message: `Le motif ne peut pas dépasser ${END_REASON_MAX_LENGTH} caractères.`,
  })
  reason?: string;
}
