import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RewardSettingItemDto {
  @ApiProperty({
    description: 'Unique key for this setting',
    example: 'inscription_price_cents',
  })
  @IsString()
  @IsNotEmpty()
  settingKey: string;

  @ApiProperty({
    description: 'Human-readable label',
    example: 'Prix inscription (centimes)',
  })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({
    description: 'Numeric value for the setting',
    example: 9900,
  })
  @IsInt()
  value: number;

  @ApiPropertyOptional({
    description: 'Description of the purpose and unit',
    example: 'Montant en centimes euro pour une inscription standard',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateRewardSettingsDto {
  @ApiProperty({
    type: [RewardSettingItemDto],
    description: 'List of reward settings to upsert',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RewardSettingItemDto)
  settings: RewardSettingItemDto[];

  @ApiPropertyOptional({ description: 'Correlation ID for inter-service tracing' })
  @IsOptional()
  @IsString()
  correlationId?: string;
}
