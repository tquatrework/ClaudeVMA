import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({
    example: 'a3f1e2b4-...',
    description: 'Token de vérification reçu par email',
  })
  @IsString()
  @MinLength(10)
  token: string;
}
