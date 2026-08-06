import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * firstName/lastName/phone (parent et élève) appartiennent exclusivement à
 * profile-service (arbitrage d'architecture du 2026-08-06) : non collectés
 * ici, y compris pour un élève nouvellement créé dans le même appel.
 */
export class CreateParentAccountDto {
  @ApiProperty({ example: 'parent@example.com', description: 'Parent financeur email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

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
}
