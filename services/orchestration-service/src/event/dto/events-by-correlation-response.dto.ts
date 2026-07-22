import { ApiProperty } from '@nestjs/swagger';
import { EventSummaryDto } from './event-summary.dto';

export class EventsByCorrelationResponseDto {
  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  count: number;

  @ApiProperty({ type: [EventSummaryDto] })
  events: EventSummaryDto[];
}
