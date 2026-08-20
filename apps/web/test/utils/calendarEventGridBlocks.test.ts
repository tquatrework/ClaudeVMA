import { describe, it, expect } from 'vitest'
import {
  toCalendarEventGridBlock,
  toCalendarEventGridBlocks,
} from '../../src/utils/calendarEventGridBlocks'
import type { CalendarEvent } from '../../src/components/calendar/calendarTypes'

const REFERENCE_DATE = new Date('2026-09-10T00:00:00.000Z') // jeudi

function buildEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    title: 'Cours de maths',
    startAt: '2026-09-10T14:00:00.000Z',
    endAt: '2026-09-10T15:00:00.000Z',
    eventType: 'cours',
    ...overrides,
  }
}

describe('toCalendarEventGridBlock', () => {
  it('traduit un événement dans la fenêtre en bloc EVENT exploitable par la grille', () => {
    const block = toCalendarEventGridBlock(buildEvent(), REFERENCE_DATE)

    expect(block).not.toBeNull()
    expect(block?.kind).toBe('EVENT')
    expect(block?.dayOfWeek).toBe(4) // jeudi
    expect(block?.startTime).toBe('14:00')
    expect(block?.endTime).toBe('15:00')
    expect(block?.event.id).toBe('evt-1')
  })

  it('renvoie null si startAt est illisible', () => {
    const block = toCalendarEventGridBlock(buildEvent({ startAt: 'not-a-date' }), REFERENCE_DATE)
    expect(block).toBeNull()
  })

  it('écrête la fin à 23:59 quand elle chevauche le jour suivant', () => {
    const block = toCalendarEventGridBlock(
      buildEvent({ startAt: '2026-09-10T23:00:00.000Z', endAt: '2026-09-11T01:00:00.000Z' }),
      REFERENCE_DATE,
    )
    expect(block?.endTime).toBe('23:59')
  })

  it('exclut un événement trop loin dans le passé (hors fenêtre -14 jours)', () => {
    const block = toCalendarEventGridBlock(
      buildEvent({ startAt: '2026-08-01T14:00:00.000Z', endAt: '2026-08-01T15:00:00.000Z' }),
      REFERENCE_DATE,
    )
    expect(block).toBeNull()
  })

  it('exclut un événement trop loin dans le futur (hors fenêtre +28 jours)', () => {
    const block = toCalendarEventGridBlock(
      buildEvent({ startAt: '2026-11-01T14:00:00.000Z', endAt: '2026-11-01T15:00:00.000Z' }),
      REFERENCE_DATE,
    )
    expect(block).toBeNull()
  })

  it('inclut un événement dans la fenêtre passée (-14 jours)', () => {
    const block = toCalendarEventGridBlock(
      buildEvent({ startAt: '2026-08-28T14:00:00.000Z', endAt: '2026-08-28T15:00:00.000Z' }),
      REFERENCE_DATE,
    )
    expect(block).not.toBeNull()
  })
})

describe('toCalendarEventGridBlocks', () => {
  it('écarte les événements illisibles ou hors fenêtre, garde les autres', () => {
    const blocks = toCalendarEventGridBlocks(
      [
        buildEvent({ id: 'evt-ok' }),
        buildEvent({ id: 'evt-bad-date', startAt: 'nope' }),
        buildEvent({
          id: 'evt-far-future',
          startAt: '2027-01-01T00:00:00.000Z',
          endAt: '2027-01-01T01:00:00.000Z',
        }),
      ],
      REFERENCE_DATE,
    )

    expect(blocks.map((block) => block.id)).toEqual(['evt-ok'])
  })
})
