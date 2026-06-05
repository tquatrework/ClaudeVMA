import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, MaxLength } from 'class-validator';

export class UpdateAdministrativeProfileDto {
  @ApiPropertyOptional({ description: 'First name', example: 'Marie' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Dupont' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Date of birth (ISO date)', example: '2005-06-15' })
  @IsOptional()
  @IsDateString()
  dateNaissance?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '+33612345678' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telephone?: string;

  @ApiPropertyOptional({ description: 'Address line 1', example: '12 rue de la Paix' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  adresseLigne1?: string;

  @ApiPropertyOptional({ description: 'Address line 2 (apartment, floor…)', example: 'Apt 3B' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  adresseLigne2?: string;

  @ApiPropertyOptional({ description: 'Postal code', example: '75001' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  codePostal?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Paris' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ville?: string;

  @ApiPropertyOptional({ description: 'Country', example: 'France' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  pays?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.visiomath.fr/avatars/abc.jpg' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  avatarUrl?: string;
}
