import { IsEmail, IsString, MinLength, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, SELF_REGISTRATION_ROLES } from '../../auth/entities/user.entity';

/**
 * Décision du 2026-08-06 (précision apportée après un premier revirement trop
 * large, voir docs/architecture.md > "Arbitrages rendus") : firstName/lastName/
 * phone restent la propriété exclusive de profile-service et ne sont jamais
 * persistés localement. Cette route générique (`POST /accounts`, non utilisée
 * par le front d'auto-inscription) ne les collecte pas. Les 3 routes
 * d'auto-inscription directe dédiées par rôle (`POST /accounts/students`,
 * `POST /accounts/teachers`, `POST /accounts/parents`) les acceptent en
 * revanche, uniquement pour les relayer immédiatement à profile-service — voir
 * create-student-account.dto.ts, create-teacher-account.dto.ts et
 * create-parent-account.dto.ts.
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
