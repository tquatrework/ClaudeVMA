import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IntegrationCommand } from '../entities/integration-command.entity';

/**
 * Contrat de réponse pour une commande d'intégration.
 * Isole les contrôleurs de la forme exacte de l'entité TypeORM.
 */
export class CommandResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  targetService: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  idempotencyKey: string;

  @ApiProperty()
  correlationId: string;

  @ApiProperty()
  dispatched: boolean;

  @ApiPropertyOptional()
  result?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  error?: string | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  dispatchedAt?: Date | null;

  static fromEntity(entity: IntegrationCommand): CommandResponseDto {
    const dto = new CommandResponseDto();
    dto.id = entity.id;
    dto.targetService = entity.targetService;
    dto.action = entity.action;
    dto.idempotencyKey = entity.idempotencyKey;
    dto.correlationId = entity.correlationId;
    dto.dispatched = entity.dispatched;
    dto.result = entity.result ?? null;
    dto.error = entity.error ?? null;
    dto.createdAt = entity.createdAt;
    dto.dispatchedAt = entity.dispatchedAt ?? null;
    return dto;
  }
}
