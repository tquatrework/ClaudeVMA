import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Conversation } from '../entities/conversation.entity';

/**
 * Explicit response contract for a Conversation. Controllers never return
 * the TypeORM entity directly.
 */
export class ConversationResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ type: [String] }) participantIds: string[];
  @ApiPropertyOptional({ nullable: true }) subject: string | null;
  @ApiProperty() isIncident: boolean;
  @ApiPropertyOptional({ nullable: true }) incidentId: string | null;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;

  static fromEntity(entity: Conversation): ConversationResponseDto {
    const dto = new ConversationResponseDto();
    dto.id = entity.id;
    dto.participantIds = entity.participantIds;
    dto.subject = entity.subject;
    dto.isIncident = entity.isIncident;
    dto.incidentId = entity.incidentId;
    dto.createdAt = entity.createdAt;
    dto.updatedAt = entity.updatedAt;
    return dto;
  }
}
