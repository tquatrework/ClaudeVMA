import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TeacherProposal, ProposalStatus } from '../../entities/teacher-proposal.entity';

export class TeacherProposalResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  requestId: string;

  @ApiProperty()
  teacherId: string;

  @ApiPropertyOptional()
  availabilityNote: string | null;

  @ApiProperty({ enum: ProposalStatus })
  status: ProposalStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: TeacherProposal): TeacherProposalResponseDto {
    const dto = new TeacherProposalResponseDto();
    dto.id = entity.id;
    dto.requestId = entity.requestId;
    dto.teacherId = entity.teacherId;
    dto.availabilityNote = entity.availabilityNote ?? null;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  static fromEntities(entities: TeacherProposal[]): TeacherProposalResponseDto[] {
    return entities.map((entity) => TeacherProposalResponseDto.fromEntity(entity));
  }
}
