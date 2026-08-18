import { SlotRecurrence } from './entities/availability-slot.entity';

/**
 * Minimal shape needed to project a slot into concrete occurrences.
 * Deliberately independent from the TypeORM entity so this function stays
 * pure and reusable (e.g. by point 2 of the calendrier de disponibilités
 * chantier — visibilité busy/free — without any dependency on this module's
 * controller/service).
 */
export interface RecurrableSlot {
  startTime: Date;
  endTime: Date;
  recurrence: SlotRecurrence;
  /** Inclusive cutoff instant. Null means the recurrence never ends. */
  recurrenceEndDate: Date | null;
}

export interface Occurrence {
  start: Date;
  end: Date;
}

/**
 * Projects a (possibly recurring) slot into concrete occurrences intersecting
 * `[rangeStart, rangeEnd)`.
 *
 * - `NONE`: at most one occurrence — the slot's own `startTime`/`endTime` —
 *   returned only if it intersects the requested window.
 * - `WEEKLY` / `BIWEEKLY`: one occurrence every 7 or 14 days starting from
 *   `startTime`, each occurrence keeping the slot's original duration
 *   (`endTime - startTime`). Bounded by `recurrenceEndDate` when set (the
 *   slot never producing an occurrence starting after that inclusive
 *   instant), and always bounded by `rangeEnd` — an unbounded recurrence
 *   (`recurrenceEndDate: null`) is therefore never expanded past the
 *   requested window, preserving today's "illimité" behaviour.
 *
 * Pure function: no I/O, no dependency on NestJS/TypeORM, safe to unit-test
 * in isolation and to reuse unmodified from other call sites.
 */
export function expandSlotToOccurrences(
  slot: RecurrableSlot,
  rangeStart: Date,
  rangeEnd: Date,
): Occurrence[] {
  const duration = slot.endTime.getTime() - slot.startTime.getTime();
  if (duration <= 0 || rangeEnd.getTime() <= rangeStart.getTime()) return [];

  if (slot.recurrence === SlotRecurrence.NONE) {
    return intersects(slot.startTime, slot.endTime, rangeStart, rangeEnd)
      ? [{ start: slot.startTime, end: slot.endTime }]
      : [];
  }

  const stepMs =
    (slot.recurrence === SlotRecurrence.WEEKLY ? 7 : 14) * 24 * 60 * 60 * 1000;

  const hardEnd = slot.recurrenceEndDate
    ? new Date(Math.min(slot.recurrenceEndDate.getTime(), rangeEnd.getTime() - 1))
    : new Date(rangeEnd.getTime() - 1);

  if (slot.startTime.getTime() > hardEnd.getTime()) return [];

  // Jump directly to the first occurrence that could intersect rangeStart,
  // instead of iterating one step at a time from the slot's origin (which
  // could be years before the requested window).
  const stepsToRangeStart = Math.floor(
    (rangeStart.getTime() - duration - slot.startTime.getTime()) / stepMs,
  );
  let occurrenceStart = new Date(
    slot.startTime.getTime() + Math.max(0, stepsToRangeStart) * stepMs,
  );

  const occurrences: Occurrence[] = [];
  while (occurrenceStart.getTime() <= hardEnd.getTime()) {
    const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
    if (intersects(occurrenceStart, occurrenceEnd, rangeStart, rangeEnd)) {
      occurrences.push({ start: occurrenceStart, end: occurrenceEnd });
    }
    occurrenceStart = new Date(occurrenceStart.getTime() + stepMs);
  }

  return occurrences;
}

function intersects(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date,
): boolean {
  return startA.getTime() < endB.getTime() && endA.getTime() > startB.getTime();
}
