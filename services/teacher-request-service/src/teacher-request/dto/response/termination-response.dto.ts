import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TerminationRequest, TerminationStatus } from '../../entities/termination-request.entity';

export class TerminationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  assignmentId: string;

  @ApiProperty()
  teacherId: string;

  @ApiProperty()
  noticeDate: Date;

  @ApiPropertyOptional()
  reason: string | null;

  @ApiProperty({ enum: TerminationStatus })
  status: TerminationStatus;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(entity: TerminationRequest): TerminationResponseDto {
    const dto = new TerminationResponseDto();
    dto.id = entity.id;
    dto.assignmentId = entity.assignmentId;
    dto.teacherId = entity.teacherId;
    dto.noticeDate = entity.noticeDate;
    dto.reason = entity.reason ?? null;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    return dto;
  }
}
