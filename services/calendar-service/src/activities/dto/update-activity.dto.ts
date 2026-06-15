import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsDateString,
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ActivityType, ActivityStatus } from '../entities/scheduled-activity.entity';

export class UpdateActivityDto {
  @ApiPropertyOptional({ example: 'Cours de géométrie avancé' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ enum: ActivityType })
  @IsOptional()
  @IsEnum(ActivityType)
  type?: ActivityType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one participant is required (CAL-FB-002)' })
  @IsUUID('4', { each: true })
  participantIds?: string[];

  @ApiPropertyOptional({ example: '2026-06-10T14:00:00Z' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ example: '2026-06-10T15:00:00Z' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ enum: ActivityStatus })
  @IsOptional()
  @IsEnum(ActivityStatus)
  status?: ActivityStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Correlation ID for inter-service tracing' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}
