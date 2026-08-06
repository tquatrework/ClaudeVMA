import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, SELF_REGISTRATION_ROLES } from '../../auth/entities/user.entity';

/**
 * firstName/lastName/phone appartiennent exclusivement à profile-service
 * (arbitrage d'architecture du 2026-08-06, docs/architecture.md > "Arbitrages
 * rendus") : identity-access-service ne les collecte plus du tout à la
 * création de compte, ni ne les rend obligatoires. Toute collecte de ces
 * champs (front, workflows d'onboarding) doit désormais alimenter
 * profile-service directement.
 */
export class CreateAccountDto {
  @ApiProperty({ example: 'eleve@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

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
