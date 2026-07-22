import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { EventService } from './event.service';
import { EventSummaryDto } from './dto/event-summary.dto';
import { EventsByCorrelationResponseDto } from './dto/events-by-correlation-response.dto';
import { JwtAuthGuard } from '../security/jwt-auth.guard';

@ApiTags('events')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventController {
  constructor(private readonly eventService: EventService) {}

  @Get(':correlationId')
  @ApiOperation({
    summary: 'Lire les événements liés à une corrélation',
    description: 'Retourne l\'historique chronologique des événements pour un correlationId donné.',
  })
  @ApiParam({ name: 'correlationId', description: 'UUID de corrélation' })
  @ApiResponse({ status: 200, description: 'Liste des événements', type: EventsByCorrelationResponseDto })
  async findByCorrelation(
    @Param('correlationId', ParseUUIDPipe) correlationId: string,
  ): Promise<EventsByCorrelationResponseDto> {
    const events = await this.eventService.findByCorrelation(correlationId);
    return {
      correlationId,
      count: events.length,
      events: events.map((event) => EventSummaryDto.fromEntity(event)),
    };
  }
}
