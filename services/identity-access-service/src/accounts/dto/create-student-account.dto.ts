import { IsEmail, IsString, MinLength, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateStudentAccountDto {
  @ApiProperty({ example: 'eleve@example.com', description: 'Student email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

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

  @ApiPropertyOptional({
    description:
      'Login identifier of an existing parent financeur account to link. ' +
      'Takes priority over parentEmail when both are provided.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  parentLoginIdentifier?: string;

  @ApiPropertyOptional({
    description:
      'Email of the parent financeur to associate at registration. ' +
      'If 0 matching accounts exist, a new parent account is created. ' +
      'If exactly 1 matching account exists, it is linked. ' +
      'If 2+ accounts share this email, use parentLoginIdentifier instead.',
  })
  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @ApiPropertyOptional({ description: 'Password for the new parent account (used only when parentEmail triggers account creation)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  parentPassword?: string;
}
