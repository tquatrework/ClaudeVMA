import { IsUUID, IsOptional, IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePpChangeDto {
  @ApiProperty({ description: 'Student UUID whose principal teacher should change' })
  @IsUUID()
  studentId: string;

  @ApiProperty({ description: 'UUID of the current principal teacher to be replaced' })
  @IsUUID()
  currentPpTeacherId: string;

  @ApiProperty({ example: 'Mathématiques avancées' })
  @IsString()
  @IsNotEmpty()
  subject: string;

  @ApiPropertyOptional({ description: 'Reason or context for the change request' })
  @IsOptional()
  @IsString()
  message?: string;
}
