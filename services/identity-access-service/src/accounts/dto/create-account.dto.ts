import { IsEmail, IsString, MinLength, MaxLength, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole, SELF_REGISTRATION_ROLES } from '../../auth/entities/user.entity';

export class CreateAccountDto {
  @ApiProperty({ example: 'eleve@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Jean', description: 'Account holder first name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @ApiProperty({ example: 'Dupont', description: 'Account holder last name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

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
