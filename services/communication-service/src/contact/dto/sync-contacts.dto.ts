import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContactEntryDto {
  @ApiProperty({ description: 'UUID of the contact to authorize' })
  @IsUUID()
  contactId: string;

  @ApiPropertyOptional({
    description: 'ISO date string: optional expiry for time-limited contact windows',
    example: '2026-09-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Relation type for audit (e.g. "teacher-student")' })
  @IsOptional()
  @IsString()
  relationType?: string;
}

export class SyncContactsDto {
  @ApiProperty({ description: 'User UUID whose contact list is being initialized/updated' })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'List of authorized contact entries',
    type: [ContactEntryDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactEntryDto)
  contacts: ContactEntryDto[];
}
