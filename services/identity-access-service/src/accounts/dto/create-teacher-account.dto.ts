import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTeacherAccountDto {
  @ApiProperty({ example: 'formateur@example.com', description: 'Teacher email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Marie', description: 'Teacher first name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Martin', description: 'Teacher last name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({
    example: 'marie.martin',
    description: 'Desired login identifier. If omitted, one is generated from the email address.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  loginIdentifier?: string;

  @ApiPropertyOptional({ description: 'URL or reference to the submitted CV' })
  @IsOptional()
  @IsString()
  cvReference?: string;
}
