import { IsNotEmpty, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignDocumentDto {
  @ApiProperty({
    description: 'Full name of the signer (as it should appear on the document)',
    example: 'Marie Dupont',
  })
  @IsString()
  @IsNotEmpty()
  signerName: string;

  @ApiPropertyOptional({
    description: 'Email of the signer (optional — defaults to JWT email)',
    example: 'marie.dupont@example.com',
  })
  @IsOptional()
  @IsString()
  signerEmail?: string;
}
