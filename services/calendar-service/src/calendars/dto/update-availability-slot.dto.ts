import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  ValidateIf,
} from 'class-validator';
import { SlotRecurrence, SlotKind } from '../entities/availability-slot.entity';

export class UpdateAvailabilitySlotDto {
  @ApiPropertyOptional({ description: 'Day of week 0=Sunday…6=Saturday (for recurring)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiPropertyOptional({ description: 'Slot start time (ISO 8601)', example: '2026-09-10T09:00:00Z' })
  @IsOptional()
  @IsDateString()
  startTime?: string;

  @ApiPropertyOptional({ description: 'Slot end time (ISO 8601)', example: '2026-09-10T11:00:00Z' })
  @IsOptional()
  @IsDateString()
  endTime?: string;

  @ApiPropertyOptional({ enum: SlotRecurrence })
  @IsOptional()
  @IsEnum(SlotRecurrence)
  recurrence?: SlotRecurrence;

  @ApiPropertyOptional({
    description:
      'Inclusive end date of the recurrence (ISO 8601). Omit the field to leave it ' +
      'unchanged; send an explicit null to clear it (recurrence becomes unbounded again).',
    example: '2026-12-20T23:59:59Z',
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @IsDateString()
  recurrenceEndDate?: string | null;

  @ApiPropertyOptional({ enum: SlotKind })
  @IsOptional()
  @IsEnum(SlotKind)
  kind?: SlotKind;
}
