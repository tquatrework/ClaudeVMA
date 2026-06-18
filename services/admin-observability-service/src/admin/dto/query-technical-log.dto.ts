import { IsOptional, IsEnum, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { LogLevel } from '../../common/enums/log-level.enum';

export class QueryTechnicalLogDto {
  @ApiPropertyOptional({ enum: LogLevel, description: "Filtrer par niveau de log" })
  @IsOptional()
  @IsEnum(LogLevel)
  level?: LogLevel;

  @ApiPropertyOptional({ description: "Filtrer par nom de service" })
  @IsOptional()
  @IsString()
  service?: string;

  @ApiPropertyOptional({ description: 'Page (défaut: 1)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: 'Résultats par page (défaut: 20)', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
