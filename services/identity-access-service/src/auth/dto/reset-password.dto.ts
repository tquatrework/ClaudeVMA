import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'a3f1e2b4-...',
    description: 'Token de réinitialisation reçu par email',
  })
  @IsString()
  @MinLength(10)
  token: string;

  @ApiProperty({
    example: 'NouveauMotDePasse123!',
    description: 'Nouveau mot de passe (minimum 8 caractères)',
  })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
