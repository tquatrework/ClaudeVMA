import { expandSlotToOccurrences, RecurrableSlot } from '../../../src/calendars/recurrence.util';
import { SlotRecurrence } from '../../../src/calendars/entities/availability-slot.entity';

function slot(overrides: Partial<RecurrableSlot> = {}): RecurrableSlot {
  return {
    startTime: new Date('2026-09-07T09:00:00Z'), // Monday
    endTime: new Date('2026-09-07T11:00:00Z'),
    recurrence: SlotRecurrence.NONE,
    recurrenceEndDate: null,
    ...overrides,
  };
}

describe('expandSlotToOccurrences', () => {
  describe('NONE', () => {
    it('returns the single occurrence when it intersects the window', () => {
      const result = expandSlotToOccurrences(
        slot(),
        new Date('2026-09-01T00:00:00Z'),
        new Date('2026-09-30T00:00:00Z'),
      );
      expect(result).toEqual([
        { start: new Date('2026-09-07T09:00:00Z'), end: new Date('2026-09-07T11:00:00Z') },
      ]);
    });

    it('returns nothing when the window is entirely before the occurrence', () => {
      const result = expandSlotToOccurrences(
        slot(),
        new Date('2026-08-01T00:00:00Z'),
        new Date('2026-09-01T00:00:00Z'),
      );
      expect(result).toEqual([]);
    });

    it('returns nothing when the window is entirely after the occurrence', () => {
      const result = expandSlotToOccurrences(
        slot(),
        new Date('2026-09-08T00:00:00Z'),
        new Date('2026-09-30T00:00:00Z'),
      );
      expect(result).toEqual([]);
    });
  });

  describe('WEEKLY without an end date', () => {
    it('projects one occurrence per week, bounded only by the requested window', () => {
      const result = expandSlotToOccurrences(
        slot({ recurrence: SlotRecurrence.WEEKLY }),
        new Date('2026-09-01T00:00:00Z'),
        new Date('2026-09-29T00:00:00Z'), // 4 weeks window
      );

      expect(result).toHaveLength(4);
      expect(result[0]).toEqual({
        start: new Date('2026-09-07T09:00:00Z'),
        end: new Date('2026-09-07T11:00:00Z'),
      });
      expect(result[1].start).toEqual(new Date('2026-09-14T09:00:00Z'));
      expect(result[2].start).toEqual(new Date('2026-09-21T09:00:00Z'));
      expect(result[3].start).toEqual(new Date('2026-09-28T09:00:00Z'));
    });

    it('keeps producing occurrences far beyond the slot origin when no end date is set', () => {
      const result = expandSlotToOccurrences(
        slot({ recurrence: SlotRecurrence.WEEKLY }),
        new Date('2027-03-01T00:00:00Z'),
        new Date('2027-03-08T00:00:00Z'),
      );
      // Should still find the weekly occurrence landing inside this much later window.
      expect(result).toHaveLength(1);
    });
  });

  describe('WEEKLY with an end date', () => {
    it('stops projecting once recurrenceEndDate is passed, even if the window is wider', () => {
      const result = expandSlotToOccurrences(
        slot({
          recurrence: SlotRecurrence.WEEKLY,
          recurrenceEndDate: new Date('2026-09-14T23:59:59Z'),
        }),
        new Date('2026-09-01T00:00:00Z'),
        new Date('2026-10-31T00:00:00Z'),
      );

      expect(result).toHaveLength(2);
      expect(result[0].start).toEqual(new Date('2026-09-07T09:00:00Z'));
      expect(result[1].start).toEqual(new Date('2026-09-14T09:00:00Z'));
    });

    it('returns nothing when the requested window starts entirely after recurrenceEndDate', () => {
      const result = expandSlotToOccurrences(
        slot({
          recurrence: SlotRecurrence.WEEKLY,
          recurrenceEndDate: new Date('2026-09-14T23:59:59Z'),
        }),
        new Date('2026-10-01T00:00:00Z'),
        new Date('2026-10-31T00:00:00Z'),
      );
      expect(result).toEqual([]);
    });
  });

  describe('BIWEEKLY', () => {
    it('projects one occurrence every 14 days', () => {
      const result = expandSlotToOccurrences(
        slot({ recurrence: SlotRecurrence.BIWEEKLY }),
        new Date('2026-09-01T00:00:00Z'),
        new Date('2026-10-15T00:00:00Z'), // ~6 weeks window
      );

      expect(result).toHaveLength(3);
      expect(result[0].start).toEqual(new Date('2026-09-07T09:00:00Z'));
      expect(result[1].start).toEqual(new Date('2026-09-21T09:00:00Z'));
      expect(result[2].start).toEqual(new Date('2026-10-05T09:00:00Z'));
    });

    it('respects recurrenceEndDate on a biweekly recurrence', () => {
      const result = expandSlotToOccurrences(
        slot({
          recurrence: SlotRecurrence.BIWEEKLY,
          recurrenceEndDate: new Date('2026-09-21T23:59:59Z'),
        }),
        new Date('2026-09-01T00:00:00Z'),
        new Date('2026-12-31T00:00:00Z'),
      );
      expect(result).toHaveLength(2);
      expect(result[1].start).toEqual(new Date('2026-09-21T09:00:00Z'));
    });
  });

  describe('occurrence duration', () => {
    it('preserves the original slot duration on every generated occurrence', () => {
      const result = expandSlotToOccurrences(
        slot({
          startTime: new Date('2026-09-07T14:30:00Z'),
          endTime: new Date('2026-09-07T16:15:00Z'),
          recurrence: SlotRecurrence.WEEKLY,
        }),
        new Date('2026-09-07T00:00:00Z'),
        new Date('2026-09-21T00:00:00Z'),
      );

      const durations = result.map((o) => o.end.getTime() - o.start.getTime());
      expect(durations).toEqual([1000 * 60 * 105, 1000 * 60 * 105]); // 1h45 each
    });
  });

  describe('degenerate inputs', () => {
    it('returns nothing when endTime is not after startTime', () => {
      const result = expandSlotToOccurrences(
        slot({ endTime: new Date('2026-09-07T09:00:00Z') }),
        new Date('2026-09-01T00:00:00Z'),
        new Date('2026-09-30T00:00:00Z'),
      );
      expect(result).toEqual([]);
    });
  });
});
