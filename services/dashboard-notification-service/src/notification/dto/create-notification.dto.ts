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

  @ApiProperty({ example: 'Séance confirmée' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Votre séance du 10/06 à 14h est confirmée.' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Additional event metadata (JSONB)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
