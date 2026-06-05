import { Controller, Post, Param, Body, Logger, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { EventService } from '../event/event.service';
import { EventDirection } from '../event/entities/integration-event.entity';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('callbacks')
@Controller('callbacks')
export class CallbackController {
  private readonly logger = new Logger(CallbackController.name);

  constructor(private readonly eventService: EventService) {}

  @Post(':provider')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recevoir un callback d\'un fournisseur externe',
    description: 'Point d\'entrée générique pour les webhooks des providers (ex: fournisseur vidéo, paiement).',
  })
  @ApiParam({ name: 'provider', description: 'Identifiant du provider', example: 'video-provider' })
  @ApiResponse({ status: 200, description: 'Callback enregistré' })
  async receive(@Param('provider') provider: string, @Body() body: Record<string, any>) {
    const correlationId = body.correlationId ?? body.correlation_id ?? uuidv4();
    const eventType = body.eventType ?? body.event_type ?? `${provider}.callback`;

    await this.eventService.record(
      eventType,
      correlationId,
      EventDirection.CONSUMED,
      body,
      provider,
    );

    this.logger.log(`[${correlationId}] Callback from ${provider}: ${eventType}`);
    return { received: true, correlationId };
  }
}
