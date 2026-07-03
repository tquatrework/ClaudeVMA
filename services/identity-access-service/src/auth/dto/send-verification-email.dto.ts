import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SendVerificationEmailDto {
  @ApiProperty({
    example: 'jean.dupont@example.com',
    description: 'Adresse email à vérifier — doit correspondre à un compte existant',
  })
  @IsEmail()
  email: string;
}
