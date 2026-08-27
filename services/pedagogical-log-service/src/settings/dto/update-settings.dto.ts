import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsBoolean, IsInt, Min } from 'class-validator';

export class UpdateSettingsDto {
  @ApiPropertyOptional({ description: 'Active ou désactive les pièces jointes sur le cahier de texte' })
  @IsOptional()
  @IsBoolean()
  attachmentsEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Plafond par fichier, en octets (défaut 100 000)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxFileBytes?: number;

  @ApiPropertyOptional({ description: 'Plafond total des pièces jointes par entrée, en octets (défaut 5 000 000)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTotalBytesPerEntry?: number;
}
