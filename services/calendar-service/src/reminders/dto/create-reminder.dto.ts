import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsUUID, IsDateString, IsOptional } from 'class-validator';

export class CreateReminderDto {
  @ApiProperty({ description: 'User ID this reminder targets' })
  @IsUUID()
  ownerId: string;

  @ApiProperty({ description: 'Role of the target user' })
  @IsString()
  ownerRole: string;

  @ApiPropertyOptional({ description: 'Optional linked ScheduledActivity ID' })
  @IsOptional()
  @IsUUID()
  activityId?: string;

  @ApiProperty({ example: 'Entretien RP avec formateur prévu demain' })
  @IsString()
  message: string;

  @ApiProperty({ description: 'When to trigger the reminder (ISO 8601)', example: '2026-06-09T08:00:00Z' })
  @IsDateString()
  remindAt: string;
}
