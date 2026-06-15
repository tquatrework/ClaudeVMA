import { Controller, Post, Param, Body, Logger, HttpCode, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader } from '@nestjs/swagger';
import { EventService } from '../event/event.service';
import { EventDirection } from '../event/entities/integration-event.entity';
import { WebhookSecretGuard } from '../common/guards/webhook-secret.guard';
import { v4 as uuidv4 } from 'uuid';

@ApiTags('callbacks')
@Controller('callbacks')
export class CallbackController {
  private readonly logger = new Logger(CallbackController.name);

  constructor(private readonly eventService: EventService) {}

  @Post(':provider')
  @HttpCode(200)
  @UseGuards(WebhookSecretGuard)
  @ApiOperation({
    summary: 'Recevoir un webhook de provider externe',
    description: 'Point d\'entrée générique pour les webhooks des providers (ex: fournisseur vidéo, paiement). Protégé par X-Webhook-Secret, sans JWT utilisateur.',
  })
  @ApiParam({ name: 'provider', description: 'Identifiant du provider', example: 'video-provider' })
  @ApiHeader({ name: 'X-Webhook-Secret', description: 'Secret partagé provider/service', required: true })
  @ApiResponse({ status: 200, description: 'Webhook reçu' })
  @ApiResponse({ status: 403, description: 'Secret invalide ou absent' })
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
