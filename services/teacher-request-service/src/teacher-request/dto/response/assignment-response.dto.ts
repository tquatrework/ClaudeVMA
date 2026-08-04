import { ApiProperty } from '@nestjs/swagger';

import { Assignment, AssignmentStatus } from '../../entities/assignment.entity';

export class AssignmentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  studentId: string;

  @ApiProperty()
  teacherId: string;

  @ApiProperty()
  proposalId: string;

  @ApiProperty()
  requestId: string;

  @ApiProperty()
  isMainTeacher: boolean;

  @ApiProperty({ enum: AssignmentStatus })
  status: AssignmentStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  static fromEntity(entity: Assignment): AssignmentResponseDto {
    const dto = new AssignmentResponseDto();
    dto.id = entity.id;
    dto.studentId = entity.studentId;
    dto.teacherId = entity.teacherId;
    dto.proposalId = entity.proposalId;
    dto.requestId = entity.requestId;
    dto.isMainTeacher = entity.isMainTeacher;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
