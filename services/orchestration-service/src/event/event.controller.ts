import { Controller, Get, Param, NotFoundException, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { EventService } from './event.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

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
  @ApiResponse({ status: 200, description: 'Liste des événements' })
  async findByCorrelation(@Param('correlationId') correlationId: string) {
    const events = await this.eventService.findByCorrelation(correlationId);
    return { correlationId, count: events.length, events };
  }
}
