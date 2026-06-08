import { IsString, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiPropertyOptional({ description: 'Student UUID — required when requester is PARENT' })
  @IsOptional()
  @Matches(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/, {
    message: 'studentId must be a UUID',
  })
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
