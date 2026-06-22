import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'jean.dupont',
    description: 'Unique login identifier assigned at registration',
  })
  @IsString()
  @MinLength(3)
  loginIdentifier: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @MinLength(8)
  password: string;
}
