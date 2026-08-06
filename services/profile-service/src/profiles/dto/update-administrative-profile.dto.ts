import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsNotEmpty, IsString, IsDateString, IsArray, MaxLength } from 'class-validator';

export class UpdateAdministrativeProfileDto {
  @ApiPropertyOptional({ description: 'First name', example: 'Marie' })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional({ description: 'Last name', example: 'Dupont' })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  lastName?: string;

  @ApiPropertyOptional({ description: 'Date of birth (ISO date)', example: '2005-06-15' })
  @IsOptional()
  @IsDateString()
  dateNaissance?: string;

  @ApiPropertyOptional({
    description:
      'Phone number. Canonical field name is `phone` (aligned with the internal bootstrap ' +
      'DTOs and ProfilesService); it is mapped internally onto the `telephone` entity column.',
    example: '+33612345678',
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  @MaxLength(20)
  phone?: string;

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

  @ApiPropertyOptional({ description: 'Department of residence (e.g. "75 - Paris")', example: '75 - Paris' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  departement?: string;

  @ApiPropertyOptional({ description: 'Personal interests/hobbies', example: ['Musique', 'Randonnée'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  passions?: string[];
}
