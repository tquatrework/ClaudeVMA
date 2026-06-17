import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { EventType } from '../entities/calendar-event.entity';

export class ListEventsQueryDto {
  @ApiPropertyOptional({ enum: EventType, description: 'Filter by event type' })
  @IsOptional()
  @IsEnum(EventType)
  type?: EventType;

  @ApiPropertyOptional({ description: 'Filter events involving a specific person (creator or invitee)' })
  @IsOptional()
  @IsUUID('4')
  personId?: string;
}
