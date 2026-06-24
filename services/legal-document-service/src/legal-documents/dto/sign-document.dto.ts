import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SignDocumentDto {
  @ApiProperty({
    description: 'Full name of the signer (as it should appear on the document)',
    example: 'Marie Dupont',
  })
  @IsString()
  @IsNotEmpty()
  signerName: string;
}
