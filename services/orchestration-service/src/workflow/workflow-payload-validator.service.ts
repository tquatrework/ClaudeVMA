import { BadRequestException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { WorkflowDefinition } from './definitions/workflow-definition.interface';

/**
 * Valide le `payload` de démarrage d'un workflow avant toute création
 * d'instance/étape ou appel à un service cible (ORCH-WF-ENGINE-011).
 *
 * Seuls les workflows dont la définition déclare un
 * `startPayloadValidationClass` sont contrôlés ici : les autres gardent un
 * payload de routage pur, non interprété par orchestration-service (cf.
 * l'exception documentée dans `docs/conventions/services-convention.md`).
 */
@Injectable()
export class WorkflowPayloadValidatorService {
  async validateStartPayload(
    definition: WorkflowDefinition,
    payload: Record<string, any>,
  ): Promise<void> {
    if (!definition.startPayloadValidationClass) return;

    const candidate = plainToInstance(definition.startPayloadValidationClass, payload ?? {});
    const errors = await validate(candidate as object);
    if (errors.length === 0) return;

    const messages = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new BadRequestException(
      `Payload invalide pour le workflow "${definition.id}": ${messages.join(', ')}`,
    );
  }
}
