import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetRequestDto {
  @ApiProperty({
    example: 'jean.dupont',
    description: 'Login identifier of the account to reset',
  })
  @IsString()
  @MinLength(3)
  loginIdentifier: string;
}
