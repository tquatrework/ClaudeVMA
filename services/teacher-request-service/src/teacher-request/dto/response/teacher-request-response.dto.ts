import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { TeacherRequest, RequestStatus, RequestType } from '../../entities/teacher-request.entity';
import { TeacherRequestWithNames } from '../../teacher-request.service';

export class TeacherRequestResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  requesterId: string;

  @ApiProperty()
  requesterRole: string;

  @ApiProperty()
  studentId: string;

  @ApiProperty()
  subject: string;

  @ApiPropertyOptional()
  level: string | null;

  @ApiPropertyOptional()
  sector: string | null;

  @ApiPropertyOptional()
  message: string | null;

  @ApiProperty({ enum: RequestStatus })
  status: RequestStatus;

  @ApiProperty({ enum: RequestType })
  type: RequestType;

  @ApiPropertyOptional()
  currentPpTeacherId: string | null;

  @ApiPropertyOptional({ type: [String] })
  selectedTeacherIds: string[] | null;

  @ApiPropertyOptional()
  chosenTeacherId: string | null;

  @ApiPropertyOptional({ description: 'Resolved student display name, when available' })
  studentName?: string | null;

  @ApiPropertyOptional({ description: 'Resolved chosen teacher display name, when available' })
  teacherName?: string | null;

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
    dto.subject = entity.subject;
    dto.level = entity.level ?? null;
    dto.sector = entity.sector ?? null;
    dto.message = entity.message ?? null;
    dto.status = entity.status;
    dto.type = entity.type;
    dto.currentPpTeacherId = entity.currentPpTeacherId ?? null;
    dto.selectedTeacherIds = entity.selectedTeacherIds ?? null;
    dto.chosenTeacherId = entity.chosenTeacherId ?? null;
    if ('studentName' in entity) dto.studentName = entity.studentName;
    if ('teacherName' in entity) dto.teacherName = entity.teacherName;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }

  static fromEntities(entities: (TeacherRequest | TeacherRequestWithNames)[]): TeacherRequestResponseDto[] {
    return entities.map((entity) => TeacherRequestResponseDto.fromEntity(entity));
  }
}
