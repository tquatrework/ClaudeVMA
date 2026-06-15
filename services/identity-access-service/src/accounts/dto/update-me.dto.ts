import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMeDto {
  @ApiPropertyOptional({
    example: 'newemail@example.com',
    description: 'New email address — must be unique across all accounts',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'newPassword123',
    minLength: 8,
    description: 'New password — minimum 8 characters',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}
