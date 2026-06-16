import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CancelRequestDto {
  @ApiPropertyOptional({ description: 'Optional reason for cancellation' })
  @IsOptional()
  @IsString()
  reason?: string;
}
