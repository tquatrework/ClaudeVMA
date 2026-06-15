import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  ValidateNested,
  IsDateString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { SlotRecurrence } from '../entities/availability-slot.entity';

export class AvailabilitySlotDto {
  @ApiPropertyOptional({ description: 'Day of week 0=Sunday…6=Saturday (for recurring)', example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek?: number;

  @ApiProperty({ description: 'Slot start time (ISO 8601)', example: '2026-06-10T09:00:00Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ description: 'Slot end time (ISO 8601)', example: '2026-06-10T11:00:00Z' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional({ enum: SlotRecurrence, default: SlotRecurrence.NONE })
  @IsOptional()
  @IsEnum(SlotRecurrence)
  recurrence?: SlotRecurrence;
}

export class UpdateAvailabilityDto {
  @ApiProperty({ type: [AvailabilitySlotDto], description: 'Full replacement of availability slots' })
  @IsArray()
  @ArrayMinSize(0)
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  slots: AvailabilitySlotDto[];
}
