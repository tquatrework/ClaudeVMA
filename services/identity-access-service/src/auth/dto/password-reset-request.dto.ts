import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetRequestDto {
  @ApiProperty({ example: 'user@example.com', description: 'Email address of the account to reset' })
  @IsEmail()
  email: string;
}
