import { IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiPropertyOptional({ description: 'Student UUID — required when requester is PARENT' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiProperty({ example: 'Algèbre linéaire' })
  @IsString()
  subject: string;

  @ApiPropertyOptional({ example: 'Terminale' })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ example: 'Paris 15' })
  @IsOptional()
  @IsString()
  sector?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  message?: string;
}
