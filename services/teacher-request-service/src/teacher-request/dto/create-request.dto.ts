import { IsString, IsUUID, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty()
  @IsUUID()
  studentId: string;

  @ApiProperty()
  @IsUUID()
  teacherId: string;

  @ApiProperty({ example: 'Algèbre linéaire' })
  @IsString()
  subject: string;

  @ApiPropertyOptional({ example: 'Je souhaite de l\'aide pour les matrices.' })
  @IsOptional()
  @IsString()
  message?: string;
}
