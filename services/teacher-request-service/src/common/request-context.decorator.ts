import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { JwtPayload } from './jwt.guard';
import { RequestWithCorrelationId } from './correlation-id.middleware';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/**
 * Contexte technique d'un appel, transporte jusqu'au service metier.
 *
 * Regroupe ce qui accompagne systematiquement une action sans en faire partie :
 * l'acteur, la correlation a propager aux appels sortants, et la cle
 * d'idempotence eventuelle. Les passer separement obligeait a ajouter un
 * parametre a chaque signature a chaque nouveau contrat technique.
 */
export interface RequestContext {
  user: JwtPayload;
  correlationId: string;
  idempotencyKey?: string;
  /**
   * En-tete `Authorization` de l'appel entrant, relaye a profile-service pour
   * les lectures de profil : c'est ainsi que profile-service applique SES
   * droits de lecture, au lieu que ce service les redevine.
   */
  callerAuthorization?: string;
}

export const Context = createParamDecorator((_data: unknown, context: ExecutionContext): RequestContext => {
  const request = context.switchToHttp().getRequest<RequestWithCorrelationId & { user: JwtPayload }>();
  const rawIdempotencyKey = request.headers[IDEMPOTENCY_KEY_HEADER];
  const idempotencyKey = Array.isArray(rawIdempotencyKey) ? rawIdempotencyKey[0] : rawIdempotencyKey;
  const rawAuthorization = request.headers.authorization;
  const callerAuthorization = Array.isArray(rawAuthorization) ? rawAuthorization[0] : rawAuthorization;

  return {
    user: request.user,
    correlationId: request.correlationId ?? '',
    idempotencyKey: idempotencyKey?.trim() || undefined,
    callerAuthorization,
  };
});
