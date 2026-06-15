import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConsentType } from '../entities/consent-record.entity';

export class CreateConsentDto {
  @ApiProperty({ enum: ConsentType, description: 'Type of consent being signed' })
  @IsEnum(ConsentType)
  consentType: ConsentType;

  @ApiPropertyOptional({ example: '1.0', description: 'Version of the document signed' })
  @IsOptional()
  @IsString()
  version?: string;
}
