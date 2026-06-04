import { IsString, IsUUID, IsOptional, IsArray, IsNumber, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLogDto {
  @ApiProperty()
  @IsUUID()
  sessionId: string;

  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsUUID()
  teacherId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ type: [String], example: ['dérivées', 'intégrales'] })
  @IsOptional()
  @IsArray()
  skillsWorked?: string[];

  @ApiPropertyOptional({ example: 'intermédiaire' })
  @IsOptional()
  @IsString()
  difficulty?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(5)
  rating?: number;
}
