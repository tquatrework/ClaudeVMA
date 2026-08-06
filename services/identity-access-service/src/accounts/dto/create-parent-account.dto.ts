import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, IsOptional, ValidateIf, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_NUMBER_REGEX } from './phone-number.validator';

export class CreateParentAccountDto {
  @ApiProperty({ example: 'parent@example.com', description: 'Parent financeur email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Sophie', description: 'Parent first name (forwarded to profile-service, not stored locally)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Bernard', description: 'Parent last name (forwarded to profile-service, not stored locally)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({
    example: '+33 6 01 02 03 04',
    description: 'Parent phone number (optional, forwarded to profile-service, not stored locally)',
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_NUMBER_REGEX, { message: 'phoneNumber must be a valid phone number (digits, spaces, +, -, ., parentheses, 6 to 30 characters)' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    description:
      'Login identifier of an existing student (eleve) account to link as financed student. ' +
      'Takes priority over studentEmail when both are provided. Symmetric to ' +
      'parentLoginIdentifier on CreateStudentAccountDto.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  studentLoginIdentifier?: string;

  @ApiPropertyOptional({
    description:
      'Email of the student to associate at registration. ' +
      'If 0 matching accounts exist, a new student account is created. ' +
      'If exactly 1 matching account exists, it is linked. ' +
      'If 2+ accounts share this email, use studentLoginIdentifier instead. ' +
      'Symmetric to parentEmail on CreateStudentAccountDto.',
  })
  @IsOptional()
  @IsEmail()
  studentEmail?: string;

  @ApiPropertyOptional({ description: 'Password for the new student account (used only when studentEmail triggers account creation)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  studentPassword?: string;

  @ApiPropertyOptional({
    example: 'Lucas',
    description: 'Student first name. Required when studentEmail is provided (forwarded to profile-service, not stored locally).',
  })
  @ValidateIf((dto: CreateParentAccountDto) => !!dto.studentEmail)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  studentFirstName?: string;

  @ApiPropertyOptional({
    example: 'Petit',
    description: 'Student last name. Required when studentEmail is provided (forwarded to profile-service, not stored locally).',
  })
  @ValidateIf((dto: CreateParentAccountDto) => !!dto.studentEmail)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  studentLastName?: string;
}
