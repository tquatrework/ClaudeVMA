import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { SlotRecurrence, SlotKind } from '../entities/availability-slot.entity';

export class CreateAvailabilitySlotDto {
  @ApiPropertyOptional({ description: 'Day of week 0=Sunday…6=Saturday (for recurring)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiProperty({ description: 'Slot start time (ISO 8601)', example: '2026-09-10T09:00:00Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Slot end time (ISO 8601)', example: '2026-09-10T11:00:00Z' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({ enum: SlotRecurrence, default: SlotRecurrence.NONE })
  @IsOptional()
  @IsEnum(SlotRecurrence)
  recurrence?: SlotRecurrence;

  @ApiPropertyOptional({
    description:
      'Inclusive end date of the recurrence (ISO 8601). Only meaningful for WEEKLY/BIWEEKLY. ' +
      'Omitted means the recurrence has no end date.',
    example: '2026-12-20T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;

  @ApiPropertyOptional({ enum: SlotKind, default: SlotKind.AVAILABLE })
  @IsOptional()
  @IsEnum(SlotKind)
  kind?: SlotKind;
}
