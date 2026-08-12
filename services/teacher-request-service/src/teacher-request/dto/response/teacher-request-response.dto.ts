import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TeacherRequest, RequestStatus, RequestType } from '../../entities/teacher-request.entity';

/** Demande enrichie des noms resolus aupres de profile-service. */
export interface TeacherRequestWithNames extends TeacherRequest {
  studentName: string | null;
  chosenTeacherName: string | null;
  acceptedProposalCount?: number;
  pendingProposalCount?: number;
}

/**
 * Forme de reponse d'une demande de professeur.
 *
 * `subject`, `level`, `sector`, `message` et `selectedTeacherIds` ne sont PLUS
 * exposes : ils sont sortis du flow le 2026-08-12. Les colonnes restent en base
 * tant qu'elles portent des donnees, mais une API qui continuerait a les
 * publier entretiendrait la confusion avec `description` que l'arbitrage
 * resorbe.
 */
export class TeacherRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ description: "Auteur de la demande — sert a construire l'appel suivant, jamais a etre affiche." })
  requesterId: string;

  @ApiProperty()
  requesterRole: string;

  @ApiProperty()
  studentId: string;

  @ApiPropertyOptional({
    description: "Prenom et nom de l'eleve, a afficher a la place de son identifiant.",
    nullable: true,
  })
  studentName: string | null;

  @ApiProperty({ description: 'Le besoin exprime par le demandeur — seul champ de saisie de la demande.' })
  description: string | null;

  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiProperty({ enum: RequestType })
  type: RequestType;

  @ApiPropertyOptional({ nullable: true })
  currentPpTeacherId: string | null;

  @ApiPropertyOptional({ description: 'Formateur retenu par le RP.', nullable: true })
  chosenTeacherId: string | null;

  @ApiPropertyOptional({ description: 'Prenom et nom du formateur retenu.', nullable: true })
  chosenTeacherName: string | null;

  @ApiPropertyOptional({ description: 'Nombre de formateurs candidats.', nullable: true })
  acceptedProposalCount?: number;

  @ApiPropertyOptional({ description: "Nombre de formateurs n'ayant pas encore repondu.", nullable: true })
  pendingProposalCount?: number;

  @ApiPropertyOptional({ description: 'Date de cloture par le RP.', nullable: true })
  closedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: TeacherRequest | TeacherRequestWithNames): TeacherRequestResponseDto {
    const dto = new TeacherRequestResponseDto();
    dto.id = entity.id;
    dto.requesterId = entity.requesterId;
    dto.requesterRole = entity.requesterRole;
    dto.studentId = entity.studentId;
    dto.studentName = 'studentName' in entity ? entity.studentName : null;
    dto.description = entity.description ?? null;
    dto.status = entity.status;
    dto.type = entity.type;
    dto.currentPpTeacherId = entity.currentPpTeacherId ?? null;
    dto.chosenTeacherId = entity.chosenTeacherId ?? null;
    dto.chosenTeacherName = 'chosenTeacherName' in entity ? entity.chosenTeacherName : null;
    if ('acceptedProposalCount' in entity) dto.acceptedProposalCount = entity.acceptedProposalCount;
    if ('pendingProposalCount' in entity) dto.pendingProposalCount = entity.pendingProposalCount;
    dto.closedAt = entity.closedAt ?? null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  static fromEntities(entities: (TeacherRequest | TeacherRequestWithNames)[]): TeacherRequestResponseDto[] {
    return entities.map((entity) => TeacherRequestResponseDto.fromEntity(entity));
  }
}
