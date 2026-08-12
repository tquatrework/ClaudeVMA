import { IsBoolean, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Corps de `POST /requests/:requestId/validate`.
 *
 * C'est LE point de decision du flow : le RP retient un candidat parmi ceux qui
 * ont accepte, et cette validation — elle seule — cree le lien eleve↔formateur
 * (arbitrage du 2026-08-12, point 1). Remplace `POST /requests/:id/select`,
 * qui etait reserve a l'eleve et au parent, et `POST
 * /requests/:id/selected-candidates` : tous deux relevaient de modeles
 * abandonnes.
 */
export class ValidateCandidateDto {
  @ApiProperty({ description: 'Proposition acceptee retenue par le RP.' })
  @IsUUID(undefined, { message: "L'identifiant de la proposition est invalide." })
  proposalId: string;

  @ApiPropertyOptional({
    description: "Designe le formateur comme professeur principal de l'eleve.",
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'Le champ « professeur principal » doit etre vrai ou faux.' })
  isPrincipalTeacher?: boolean;
}
