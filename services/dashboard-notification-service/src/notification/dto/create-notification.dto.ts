import { IsString, IsUUID, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../entities/notification.entity';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Target user UUID' })
  @IsUUID()
  userId: string;

  @ApiPropertyOptional({ enum: NotificationType })
  @IsOptional()
  @IsEnum(NotificationType)
  type?: NotificationType;

  // Optional since 2026-08-14: the Redis event consumer never invents a
  // French sentence server-side, it only fills structured `metadata` (see
  // EventProcessorService). `POST /internal/notify` still sends both —
  // its own DTO (InternalNotifyDto) keeps them required for that route.
  @ApiPropertyOptional({ example: 'Séance confirmée' })
  @IsOptional()
  @IsString()
  title?: string | null;

  @ApiPropertyOptional({ example: 'Votre séance du 10/06 à 14h est confirmée.' })
  @IsOptional()
  @IsString()
  message?: string | null;

  @ApiPropertyOptional({ description: 'Additional event metadata (JSONB)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
