import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, IsOptional, IsEnum, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_NUMBER_REGEX } from './phone-number.validator';
import { LinkedAccountMode } from './linked-account-mode';

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
    example: 'sophie.bernard',
    description:
      'Desired login identifier for the parent account. If omitted, one is generated from the email. ' +
      'Same contract as POST /accounts/students and POST /accounts/teachers.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  loginIdentifier?: string;

  // ---------------------------------------------------------------------------
  // Compte élève lié (optionnel) — intention explicite
  // ---------------------------------------------------------------------------

  @ApiPropertyOptional({
    enum: LinkedAccountMode,
    description:
      'Intent for the linked student (eleve) account. Required as soon as any student* field is sent. ' +
      "'existing' attaches an account already registered (identified by studentLoginIdentifier only); " +
      "'new' creates the student account (studentLoginIdentifier, studentEmail, studentFirstName, studentLastName required); " +
      "'none' (or omitted) links nothing. Any student* field without effect in the chosen mode is rejected (400), never ignored. " +
      'Symmetric to parentAccountMode on POST /accounts/students.',
  })
  @IsOptional()
  @IsEnum(LinkedAccountMode)
  studentAccountMode?: LinkedAccountMode;

  @ApiPropertyOptional({
    example: 'lucas.petit',
    description:
      'Login identifier of the student (eleve) account. ' +
      "With studentAccountMode='existing': identifier of the account to attach (404 if unknown). " +
      "With studentAccountMode='new': login identifier chosen for the student account being created " +
      '(409 if already taken). It is never derived from the email — the student must be able to log in with it.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  studentLoginIdentifier?: string;

  @ApiPropertyOptional({
    description: "Email of the student account to create. Only with studentAccountMode='new'.",
  })
  @IsOptional()
  @IsEmail()
  studentEmail?: string;

  @ApiPropertyOptional({
    description:
      "Password of the student account to create. Only with studentAccountMode='new'. " +
      "When omitted, the parent's own password is reused for the student account.",
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  studentPassword?: string;

  @ApiPropertyOptional({
    example: 'Lucas',
    description:
      "Student first name. Required with studentAccountMode='new' " +
      '(forwarded to profile-service, not stored locally).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  studentFirstName?: string;

  @ApiPropertyOptional({
    example: 'Petit',
    description:
      "Student last name. Required with studentAccountMode='new' " +
      '(forwarded to profile-service, not stored locally).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  studentLastName?: string;
}
