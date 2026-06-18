import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSiteMetadataDto {
  @ApiProperty({ description: "Nouvelle valeur pour la métadonnée" })
  @IsString()
  @IsNotEmpty()
  metaValue: string;

  @ApiPropertyOptional({ description: "Description de la métadonnée" })
  @IsOptional()
  @IsString()
  description?: string;
}
