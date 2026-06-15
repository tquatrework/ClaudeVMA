import { IsDateString, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTerminationDto {
  @ApiProperty({ description: 'Notice end date (ISO 8601)', example: '2026-09-01' })
  @IsDateString()
  noticeDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;
}
