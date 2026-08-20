import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsDateString,
  IsOptional,
  IsArray,
  IsUUID,
} from 'class-validator';
import { EventType } from '../entities/calendar-event.entity';

export class CreateCalendarEventDto {
  @ApiProperty({ example: 'Cours de géométrie' })
  @IsString()
  title: string;

  @ApiProperty({ enum: EventType, example: EventType.COURS })
  @IsEnum(EventType)
  eventType: EventType;

  @ApiProperty({ description: 'Event start time (ISO 8601)', example: '2026-06-10T14:00:00Z' })
  @IsDateString()
  startAt: string;

  @ApiProperty({ description: 'Event end time (ISO 8601)', example: '2026-06-10T15:00:00Z' })
  @IsDateString()
  endAt: string;

  @ApiPropertyOptional({ description: 'Optional description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Optional reference to an external entity (activity ID, payment ID, etc.)' })
  @IsOptional()
  @IsString()
  targetRef?: string;

  @ApiPropertyOptional({
    description: 'User IDs to invite to this event',
    type: [String],
    example: ['uuid-user-1'],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  inviteeIds?: string[];
}
