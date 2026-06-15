import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeacherAccountDto {
  @ApiProperty({ example: 'formateur@example.com', description: 'Teacher email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ description: 'URL or reference to the submitted CV' })
  @IsOptional()
  @IsString()
  cvReference?: string;
}
