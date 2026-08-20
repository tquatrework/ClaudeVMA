/** Flux Redis partagé, déjà produit par teacher-request-service et calendar-service. */
export const STREAM_NAME = 'visiomath:events';

/** Groupe de consommateurs dédié à ce service (docs/architecture.md, "Systeme de notifications transversal"). */
export const CONSUMER_GROUP = 'pedagogical-log-service';

export const CONSUMER_NAME = 'pedagogical-log-service-consumer';
export const RECLAIM_CONSUMER = 'pedagogical-log-service-reclaim';

/** Délai d'inactivité (ms) au-delà duquel une entrée non acquittée est réclamée par XAUTOCLAIM. */
export const RECLAIM_IDLE_MS = 60_000;

/**
 * Convertit un tableau plat `[k1, v1, k2, v2, ...]` (format ioredis pour les
 * champs d'une entrée de flux) en objet. Champs attendus (docs/routes.md,
 * teacher-request-service > "Événements") : eventId, eventName, aggregateType,
 * aggregateId, correlationId, occurredAt, payload (JSON).
 */
export function fieldsToRecord(fields: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let index = 0; index < fields.length; index += 2) {
    record[fields[index]] = fields[index + 1];
  }
  return record;
}
