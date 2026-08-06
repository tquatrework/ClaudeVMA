import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, IsEnum, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, SELF_REGISTRATION_ROLES } from '../../auth/entities/user.entity';
import { PHONE_NUMBER_REGEX } from './phone-number.validator';

/**
 * firstName/lastName/phoneNumber restent des champs de saisie obligatoires/optionnels
 * à l'inscription (validation inchangée), mais ne sont plus persistés localement par
 * identity-access-service depuis le 2026-08-05 : AccountsService les transmet
 * directement à profile-service (seul lieu de stockage) au moment de la création
 * de compte, voir AccountsService.persistAdministrativeProfile.
 */
export class CreateAccountDto {
  @ApiProperty({ example: 'eleve@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Jean', description: 'Account holder first name (forwarded to profile-service, not stored locally)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Dupont', description: 'Account holder last name (forwarded to profile-service, not stored locally)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @ApiPropertyOptional({
    example: '+33 6 01 02 03 04',
    description: 'Account holder phone number (optional, forwarded to profile-service, not stored locally)',
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_NUMBER_REGEX, { message: 'phoneNumber must be a valid phone number (digits, spaces, +, -, ., parentheses, 6 to 30 characters)' })
  phoneNumber?: string;

  @ApiPropertyOptional({
    enum: SELF_REGISTRATION_ROLES,
    default: UserRole.ELEVE,
    description: 'Only eleve, parent_financeur and formateur can be self-registered',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    example: 'jean.dupont',
    description: 'Desired login identifier. If omitted, one is generated from the email address.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  loginIdentifier?: string;
}
