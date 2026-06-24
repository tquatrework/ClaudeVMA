import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateMeDto {
  @ApiPropertyOptional({
    example: 'newemail@example.com',
    description: 'New email address — email is no longer required to be globally unique',
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'jean.dupont.pro',
    description: 'New login identifier — must remain globally unique',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  loginIdentifier?: string;

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
