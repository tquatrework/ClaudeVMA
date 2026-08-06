import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_NUMBER_REGEX } from './phone-number.validator';

export class CreateTeacherAccountDto {
  @ApiProperty({ example: 'formateur@example.com', description: 'Teacher email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Marie', description: 'Teacher first name (forwarded to profile-service, not stored locally)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Martin', description: 'Teacher last name (forwarded to profile-service, not stored locally)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({
    example: '+33 6 01 02 03 04',
    description: 'Teacher phone number (optional, forwarded to profile-service, not stored locally)',
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_NUMBER_REGEX, { message: 'phoneNumber must be a valid phone number (digits, spaces, +, -, ., parentheses, 6 to 30 characters)' })
  phoneNumber?: string;

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
