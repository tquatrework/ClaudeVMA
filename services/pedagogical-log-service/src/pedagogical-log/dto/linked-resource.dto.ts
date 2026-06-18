import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class LinkedResourceDto {
  @ApiProperty()
  @IsString()
  type: string;

  @ApiProperty()
  @IsString()
  id: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  label?: string;
}
