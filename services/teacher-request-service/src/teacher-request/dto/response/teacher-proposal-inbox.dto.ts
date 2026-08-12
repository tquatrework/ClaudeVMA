import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TeacherProposal, ProposalStatus } from '../../entities/teacher-proposal.entity';
import { RequestStatus } from '../../entities/teacher-request.entity';

/** Proposition accompagnee de la demande qu'elle porte. */
export interface TeacherProposalWithRequest extends TeacherProposal {
  requestDescription: string | null;
  requestStatus: RequestStatus;
  requestCreatedAt: Date;
  studentName: string | null;
}

/**
 * Vue FORMATEUR d'une proposition.
 *
 * Avant le 2026-08-12, le formateur recevait `requestId`, `teacherId`,
 * `availabilityNote` et `status` — sans description, sans nom d'eleve — et
 * `GET /requests/:id` lui repondait `403`. Il devait donc accepter ou refuser
 * sans savoir ce qu'on lui demandait.
 *
 * L'identifiant de l'eleve n'est PAS expose : le formateur en lit le nom, il
 * n'a aucun appel a construire avec son identifiant tant qu'il n'a pas ete
 * retenu.
 */
export class TeacherProposalInboxDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  requestId: string;

  @ApiPropertyOptional({ description: 'Le besoin exprime par le demandeur.', nullable: true })
  requestDescription: string | null;

  @ApiPropertyOptional({ description: "Prenom et nom de l'eleve concerne.", nullable: true })
  studentName: string | null;

  @ApiPropertyOptional({ description: 'Texte redige par le RP.', nullable: true })
  message: string | null;

  @ApiPropertyOptional({ description: 'Creneaux possibles.', nullable: true })
  availabilityNote: string | null;

  @ApiPropertyOptional({ description: 'Remuneration envisagee.', nullable: true })
  compensationNote: string | null;

  @ApiPropertyOptional({ description: 'Date limite de reponse souhaitee.', nullable: true })
  responseDeadline: string | null;

  @ApiProperty({ enum: ProposalStatus })
  status: ProposalStatus;

  @ApiProperty({ enum: RequestStatus, description: 'Etat de la demande portee par cette proposition.' })
  requestStatus: RequestStatus;

  @ApiPropertyOptional({ description: 'Date de votre reponse.', nullable: true })
  respondedAt: Date | null;

  @ApiProperty({ description: 'Date d\'envoi de la proposition.' })
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: TeacherProposalWithRequest): TeacherProposalInboxDto {
    const dto = new TeacherProposalInboxDto();
    dto.id = entity.id;
    dto.requestId = entity.requestId;
    dto.requestDescription = entity.requestDescription ?? null;
    dto.studentName = entity.studentName ?? null;
    dto.message = entity.message ?? null;
    dto.availabilityNote = entity.availabilityNote ?? null;
    dto.compensationNote = entity.compensationNote ?? null;
    dto.responseDeadline = entity.responseDeadline ?? null;
    dto.status = entity.status;
    dto.requestStatus = entity.requestStatus;
    dto.respondedAt = entity.respondedAt ?? null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  static fromEntities(entities: TeacherProposalWithRequest[]): TeacherProposalInboxDto[] {
    return entities.map((entity) => TeacherProposalInboxDto.fromEntity(entity));
  }
}
