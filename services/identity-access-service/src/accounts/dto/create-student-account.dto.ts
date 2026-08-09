import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, IsOptional, IsBoolean, IsEnum, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PHONE_NUMBER_REGEX } from './phone-number.validator';
import { LinkedAccountMode } from './linked-account-mode';
import { RegistrationConsents } from './registration-consents';
import { CreateConsentDto } from '../../consents/dto/create-consent.dto';

export class CreateStudentAccountDto {
  @ApiProperty({ example: 'eleve@example.com', description: 'Student email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Lucas', description: 'Student first name (forwarded to profile-service, not stored locally)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Petit', description: 'Student last name (forwarded to profile-service, not stored locally)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({
    example: '+33 6 01 02 03 04',
    description: 'Student phone number (optional, forwarded to profile-service, not stored locally)',
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_NUMBER_REGEX, { message: 'phoneNumber must be a valid phone number (digits, spaces, +, -, ., parentheses, 6 to 30 characters)' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    example: 'jean.dupont',
    description: 'Desired login identifier for the student. If omitted, one is generated from the email.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  loginIdentifier?: string;

  @ApiPropertyOptional({
    description: 'Whether the student account is a full member (true) or limited (false). Defaults to limited.',
  })
  @IsOptional()
  @IsBoolean()
  isMember?: boolean;

  @RegistrationConsents('the student')
  consents?: CreateConsentDto[];

  // ---------------------------------------------------------------------------
  // Compte parent financeur lié (optionnel) — intention explicite
  //
  // Aucun champ de consentement n'existe ici pour le compte lié, et c'est
  // délibéré : un consentement est personnel et ne peut pas être présumé depuis
  // celui du créateur du compte. `parentConsents` est donc un champ inconnu,
  // refusé en 400 par RejectUnknownBodyFieldsGuard. Le parent signe les siens
  // via POST /consents à sa première connexion.
  // ---------------------------------------------------------------------------

  @ApiPropertyOptional({
    enum: LinkedAccountMode,
    description:
      'Intent for the linked parent financeur account. Required as soon as any parent* field is sent. ' +
      "'existing' attaches an account already registered (identified by parentLoginIdentifier only); " +
      "'new' creates the parent account (parentLoginIdentifier, parentEmail, parentFirstName, parentLastName required); " +
      "'none' (or omitted) links nothing. Any parent* field without effect in the chosen mode is rejected (400), never ignored.",
  })
  @IsOptional()
  @IsEnum(LinkedAccountMode)
  parentAccountMode?: LinkedAccountMode;

  @ApiPropertyOptional({
    example: 'nathalie.petit',
    description:
      'Login identifier of the parent financeur account. ' +
      "With parentAccountMode='existing': identifier of the account to attach (404 if unknown). " +
      "With parentAccountMode='new': login identifier chosen for the parent account being created " +
      '(409 if already taken). It is never derived from the email — the parent must be able to log in with it.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  parentLoginIdentifier?: string;

  @ApiPropertyOptional({
    description: "Email of the parent account to create. Only with parentAccountMode='new'.",
  })
  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @ApiPropertyOptional({
    description:
      "Password of the parent account to create. Only with parentAccountMode='new'. " +
      "When omitted, the student's own password is reused for the parent account.",
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  parentPassword?: string;

  @ApiPropertyOptional({
    example: 'Nathalie',
    description:
      "Parent first name. Required with parentAccountMode='new' " +
      '(forwarded to profile-service, not stored locally).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  parentFirstName?: string;

  @ApiPropertyOptional({
    example: 'Petit',
    description:
      "Parent last name. Required with parentAccountMode='new' " +
      '(forwarded to profile-service, not stored locally).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  parentLastName?: string;
}
