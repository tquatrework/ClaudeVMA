import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RequestStatus } from '../entities/teacher-request.entity';

/**
 * Etats qu'un RP peut poser directement.
 *
 * `closed` n'y figure pas par accident : une demande se cloture en VALIDANT un
 * candidat (`POST /requests/:id/validate`), jamais en posant un statut a la
 * main — sinon on pourrait declarer une demande traitee sans qu'aucun lien
 * eleve↔formateur n'existe. Seules les demandes bloquees en `assigned` par
 * l'ancien modele peuvent etre cloturees ici.
 */
export enum ManualRequestStatus {
  DECLINED = 'declined',
  CANCELLED = 'cancelled',
  CLOSED = 'closed',
}

export class UpdateStatusDto {
  @ApiProperty({
    enum: ManualRequestStatus,
    description: "Nouvel etat de la demande. `closed` n'est accepte que sur une demande heritee de l'ancien modele.",
  })
  @IsEnum(ManualRequestStatus, {
    message: 'Le statut doit valoir « declined », « cancelled » ou « closed ».',
  })
  status: ManualRequestStatus;
}

/** Conversion vers l'enum complet porte par l'entite. */
export function toRequestStatus(status: ManualRequestStatus): RequestStatus {
  return status as unknown as RequestStatus;
}
