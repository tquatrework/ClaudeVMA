import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Contrat de validation des champs de méta-donnée reconnus par
 * l'orchestrateur dans un callback provider (camelCase ou snake_case).
 * Le reste du payload, propre à chaque provider externe, est capturé
 * tel quel depuis la requête brute pour être archivé sans perte
 * (voir CallbackController.receive).
 */
export class WebhookCallbackDto {
  @ApiPropertyOptional({ description: 'correlationId propagé par le provider' })
  @IsOptional()
  @IsString()
  correlationId?: string;

  @ApiPropertyOptional({ description: 'Variante snake_case de correlationId' })
  @IsOptional()
  @IsString()
  correlation_id?: string;

  @ApiPropertyOptional({ description: "Type d'événement du provider" })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiPropertyOptional({ description: "Variante snake_case de eventType" })
  @IsOptional()
  @IsString()
  event_type?: string;
}
