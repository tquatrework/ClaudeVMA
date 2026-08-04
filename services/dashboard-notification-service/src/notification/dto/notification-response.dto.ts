import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Notification, NotificationType } from '../entities/notification.entity';

/**
 * Explicit HTTP response contract for a notification. Controllers must
 * always return this DTO instead of the persistence entity directly.
 */
export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification UUID' })
  id: string;

  @ApiProperty({ description: 'Owner user UUID, or a role: prefix for role broadcasts' })
  userId: string;

  @ApiProperty({ enum: NotificationType })
  type: NotificationType;

  @ApiProperty()
  title: string;

  @ApiProperty()
  message: string;

  @ApiProperty()
  isRead: boolean;

  @ApiPropertyOptional({ description: 'Additional event metadata' })
  metadata: Record<string, unknown> | null;

  @ApiProperty()
  createdAt: Date;

  static fromEntity(notification: Notification): NotificationResponseDto {
    const response = new NotificationResponseDto();
    response.id = notification.id;
    response.userId = notification.userId;
    response.type = notification.type;
    response.title = notification.title;
    response.message = notification.message;
    response.isRead = notification.isRead;
    response.metadata = notification.metadata;
    response.createdAt = notification.createdAt;
    return response;
  }
}
