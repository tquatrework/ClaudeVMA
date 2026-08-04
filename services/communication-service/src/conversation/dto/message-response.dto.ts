import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Message } from '../entities/message.entity';

/**
 * Explicit response contract for a Message. Controllers never return
 * the TypeORM entity directly.
 */
export class MessageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() conversationId: string;
  @ApiProperty() senderId: string;
  @ApiProperty() content: string;
  @ApiPropertyOptional({ nullable: true }) attachmentRef: string | null;
  @ApiProperty() isSystem: boolean;
  @ApiProperty() isRead: boolean;
  @ApiProperty() sentAt: Date;

  static fromEntity(entity: Message): MessageResponseDto {
    const dto = new MessageResponseDto();
    dto.id = entity.id;
    dto.conversationId = entity.conversationId;
    dto.senderId = entity.senderId;
    dto.content = entity.content;
    dto.attachmentRef = entity.attachmentRef;
    dto.isSystem = entity.isSystem;
    dto.isRead = entity.isRead;
    dto.sentAt = entity.sentAt;
    return dto;
  }
}
