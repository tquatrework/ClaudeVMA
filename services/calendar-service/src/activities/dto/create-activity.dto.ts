import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsDateString,
  IsArray,
  ArrayMinSize,
  IsEnum,
  IsOptional,
} from 'class-validator';
import { ActivityType } from '../entities/scheduled-activity.entity';

/**
 * DTO to create a ScheduledActivity.
 * CAL-FB-002: participantIds must have at least one entry and startTime/endTime are required.
 */
export class CreateActivityDto {
  @ApiProperty({ example: 'Cours de géométrie' })
  @IsString()
  title: string;

  @ApiProperty({ enum: ActivityType, example: ActivityType.COURS })
  @IsEnum(ActivityType)
  type: ActivityType;

  @ApiProperty({
    description: 'Participant user IDs (at least one required — CAL-FB-002)',
    type: [String],
    example: ['uuid-student-1'],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one participant is required (CAL-FB-002)' })
  @IsUUID('4', { each: true })
  participantIds: string[];

  @ApiProperty({ description: 'Activity start time (ISO 8601)', example: '2026-06-10T14:00:00Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Activity end time (ISO 8601)', example: '2026-06-10T15:00:00Z' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({ example: 'Révision du chapitre 3' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Correlation ID for inter-service tracing' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}
