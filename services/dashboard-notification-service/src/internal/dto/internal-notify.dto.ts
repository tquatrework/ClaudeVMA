import { IsUUID, IsString, IsOptional, IsObject, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '../../notification/entities/notification.entity';

export class InternalNotifyDto {
  @ApiPropertyOptional({ description: 'Target user UUID (mutually exclusive with targetRole)' })
  @IsOptional()
  @IsUUID()
  targetUserId?: string;

  @ApiPropertyOptional({ description: 'Target role — notification sent to all users with that role' })
  @IsOptional()
  @IsString()
  targetRole?: string;

  @ApiProperty({ enum: NotificationType })
  @IsEnum(NotificationType)
  type: NotificationType;

  @ApiProperty({ example: 'Demande professeur créée' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Une nouvelle demande professeur a été créée.' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Additional event metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
