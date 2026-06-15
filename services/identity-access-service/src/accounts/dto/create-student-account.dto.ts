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
    description: 'Whether the student account is a full member (true) or limited (false). Defaults to limited.',
  })
  @IsOptional()
  @IsBoolean()
  isMember?: boolean;

  @ApiPropertyOptional({ description: 'Optional parent financeur email to associate at registration' })
  @IsOptional()
  @IsEmail()
  parentEmail?: string;

  @ApiPropertyOptional({ description: 'Optional parent financeur password (required if parentEmail is provided)' })
  @IsOptional()
  @IsString()
  @MinLength(8)
  parentPassword?: string;
}
