import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateParentAccountDto {
  @ApiProperty({ example: 'parent@example.com', description: 'Parent financeur email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({
    example: 'pierre.dupont',
    description: 'Desired login identifier. If omitted, one is generated from the email address.',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  loginIdentifier?: string;
}
