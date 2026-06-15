import { IsString, IsUUID, IsDateString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiProperty()
  @IsUUID()
  teacherId: string;

  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty({ example: 'Cours d\'algèbre' })
  @IsString()
  title: string;

  @ApiProperty({ example: '2026-06-10T14:00:00Z' })
  @IsDateString()
  startTime: string;

  @ApiProperty({ example: '2026-06-10T15:00:00Z' })
  @IsDateString()
  endTime: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
