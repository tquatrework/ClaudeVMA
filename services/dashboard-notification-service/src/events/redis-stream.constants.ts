/** Shared Redis stream name, produced by every service adopting the outbox + XADD pattern. */
export const EVENT_STREAM_KEY = 'visiomath:events';

/** Consumer group name for this service — one group, shared by every instance/replica. */
export const EVENT_STREAM_CONSUMER_GROUP = 'dashboard-notification-service';

/** Raw entry as returned by ioredis for XREADGROUP/XAUTOCLAIM: [entryId, flatFieldsArray]. */
export type RawStreamEntry = [string, string[]];

/**
 * Flatten the `[field, value, field, value, ...]` array Redis returns for a
 * stream entry into a plain record. Producers write exactly 7 fields per
 * entry (`eventId`, `eventName`, `aggregateType`, `aggregateId`,
 * `correlationId`, `occurredAt`, `payload`), but this helper does not
 * assume that shape — a partially malformed entry becomes a partial
 * record, handled explicitly by the caller instead of throwing here.
 */
export function fieldsToRecord(fields: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let index = 0; index < fields.length - 1; index += 2) {
    record[fields[index]] = fields[index + 1];
  }
  return record;
}
