import { IsEmail } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RecoverIdentifierDto {
  @ApiProperty({
    example: 'jean.dupont@example.com',
    description: 'Email address used at registration — returns all login identifiers associated with this email',
  })
  @IsEmail()
  email: string;
}
