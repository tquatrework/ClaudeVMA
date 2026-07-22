import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationEvent, EventDirection } from '../entities/integration-event.entity';

export class EventSummaryDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  eventType: string;

  @ApiProperty()
  correlationId: string;

  @ApiProperty({ enum: EventDirection })
  direction: EventDirection;

  @ApiPropertyOptional()
  sourceService?: string | null;

  @ApiPropertyOptional()
  payload?: Record<string, unknown> | null;

  @ApiProperty()
  processed: boolean;

  @ApiProperty()
  occurredAt: Date;

  static fromEntity(entity: IntegrationEvent): EventSummaryDto {
    const dto = new EventSummaryDto();
    dto.id = entity.id;
    dto.eventType = entity.eventType;
    dto.correlationId = entity.correlationId;
    dto.direction = entity.direction;
    dto.sourceService = entity.sourceService ?? null;
    dto.payload = entity.payload ?? null;
    dto.processed = entity.processed;
    dto.occurredAt = entity.occurredAt;
    return dto;
  }
}
