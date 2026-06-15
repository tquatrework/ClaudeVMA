import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { IncidentStatus } from '../entities/incident-thread.entity';

export class UpdateIncidentStatusDto {
  @ApiProperty({
    description: 'New status for the incident thread',
    enum: IncidentStatus,
    example: IncidentStatus.IN_PROGRESS,
  })
  @IsEnum(IncidentStatus)
  status: IncidentStatus;
}
