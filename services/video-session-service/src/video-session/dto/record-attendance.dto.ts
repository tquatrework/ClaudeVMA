import { IsOptional, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RecordAttendanceDto {
  /**
   * Optional explicit join timestamp. Defaults to now() when omitted.
   */
  @ApiPropertyOptional({ description: 'ISO 8601 timestamp when the user joined', example: '2026-06-10T09:00:00Z' })
  @IsOptional()
  @IsDateString()
  joinedAt?: string;

  /**
   * Optional left-at timestamp. Can be patched later when the user leaves.
   */
  @ApiPropertyOptional({ description: 'ISO 8601 timestamp when the user left', example: '2026-06-10T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  leftAt?: string;
}
