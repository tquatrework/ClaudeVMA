import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TeacherProposal, ProposalStatus } from '../../entities/teacher-proposal.entity';

/** Proposition enrichie du nom du formateur destinataire. */
export interface TeacherProposalWithTeacherName extends TeacherProposal {
  teacherName: string | null;
}

/**
 * Vue RP d'une proposition : QUI a ete sollicite et QUI a repondu quoi.
 *
 * C'est la lecture qui manquait entierement avant le 2026-08-12 — le RP n'avait
 * aucun moyen de savoir qui avait accepte, ce qui rendait l'etape 5 du flow
 * (« le RP choisit parmi ceux qui ont accepte ») impossible a tenir.
 */
export class TeacherProposalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  requestId: string;

  @ApiProperty({ description: "Sert a construire l'appel suivant, jamais a etre affiche." })
  teacherId: string;

  @ApiPropertyOptional({ description: 'Prenom et nom du formateur.', nullable: true })
  teacherName: string | null;

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

  @ApiPropertyOptional({ description: 'Date de la reponse du formateur.', nullable: true })
  respondedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: TeacherProposal | TeacherProposalWithTeacherName): TeacherProposalResponseDto {
    const dto = new TeacherProposalResponseDto();
    dto.id = entity.id;
    dto.requestId = entity.requestId;
    dto.teacherId = entity.teacherId;
    dto.teacherName = 'teacherName' in entity ? entity.teacherName : null;
    dto.message = entity.message ?? null;
    dto.availabilityNote = entity.availabilityNote ?? null;
    dto.compensationNote = entity.compensationNote ?? null;
    dto.responseDeadline = entity.responseDeadline ?? null;
    dto.status = entity.status;
    dto.respondedAt = entity.respondedAt ?? null;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  static fromEntities(
    entities: (TeacherProposal | TeacherProposalWithTeacherName)[],
  ): TeacherProposalResponseDto[] {
    return entities.map((entity) => TeacherProposalResponseDto.fromEntity(entity));
  }
}
