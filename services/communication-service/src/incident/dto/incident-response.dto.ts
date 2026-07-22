import { ApiProperty } from '@nestjs/swagger';
import { IncidentStatus, IncidentThread } from '../entities/incident-thread.entity';

/**
 * Explicit response contract for an IncidentThread. Controllers never return
 * the TypeORM entity directly.
 */
export class IncidentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() conversationId: string;
  @ApiProperty() openedBy: string;
  @ApiProperty() targetUserId: string;
  @ApiProperty() description: string;
  @ApiProperty({ enum: IncidentStatus }) status: IncidentStatus;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: IncidentThread): IncidentResponseDto {
    const dto = new IncidentResponseDto();
    dto.id = entity.id;
    dto.conversationId = entity.conversationId;
    dto.openedBy = entity.openedBy;
    dto.targetUserId = entity.targetUserId;
    dto.description = entity.description;
    dto.status = entity.status;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
