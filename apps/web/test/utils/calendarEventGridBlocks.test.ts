import { describe, it, expect } from 'vitest'
import {
  toCalendarEventGridBlock,
  toCalendarEventGridBlocks,
} from '../../src/utils/calendarEventGridBlocks'
import { getMondayOfWeek } from '../../src/utils/calendarDisplayWeek'
import type { CalendarEvent } from '../../src/components/calendar/calendarTypes'

// Semaine affichée : lundi 2026-09-07 → dimanche 2026-09-13 (correction du 2026-08-20, point B).
const WEEK_START = getMondayOfWeek(new Date('2026-09-10T00:00:00.000Z'))

function buildEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: 'evt-1',
    title: 'Cours de maths',
    startAt: '2026-09-10T14:00:00.000Z', // jeudi de la semaine affichée
    endAt: '2026-09-10T15:00:00.000Z',
    eventType: 'cours',
    ...overrides,
  }
}

describe('toCalendarEventGridBlock', () => {
  it('traduit un événement en bloc EVENT exploitable par la grille', () => {
    const block = toCalendarEventGridBlock(buildEvent())

    expect(block).not.toBeNull()
    expect(block?.kind).toBe('EVENT')
    expect(block?.dayOfWeek).toBe(4) // jeudi
    expect(block?.startTime).toBe('14:00')
    expect(block?.endTime).toBe('15:00')
    expect(block?.event.id).toBe('evt-1')
  })

  it('renvoie null si startAt est illisible', () => {
    const block = toCalendarEventGridBlock(buildEvent({ startAt: 'not-a-date' }))
    expect(block).toBeNull()
  })

  it('écrête la fin à 23:59 quand elle chevauche le jour suivant', () => {
    const block = toCalendarEventGridBlock(
      buildEvent({ startAt: '2026-09-10T23:00:00.000Z', endAt: '2026-09-11T01:00:00.000Z' }),
    )
    expect(block?.endTime).toBe('23:59')
  })
})

describe('toCalendarEventGridBlocks — filtrage par semaine calendaire réelle (point B)', () => {
  it('garde un événement de la semaine affichée', () => {
    const blocks = toCalendarEventGridBlocks([buildEvent()], WEEK_START)
    expect(blocks.map((block) => block.id)).toEqual(['evt-1'])
  })

  it('exclut un événement de la semaine précédente', () => {
    const blocks = toCalendarEventGridBlocks(
      [buildEvent({ id: 'evt-prev-week', startAt: '2026-09-03T14:00:00.000Z', endAt: '2026-09-03T15:00:00.000Z' })],
      WEEK_START,
    )
    expect(blocks).toEqual([])
  })

  it('exclut un événement de la semaine suivante', () => {
    const blocks = toCalendarEventGridBlocks(
      [buildEvent({ id: 'evt-next-week', startAt: '2026-09-17T14:00:00.000Z', endAt: '2026-09-17T15:00:00.000Z' })],
      WEEK_START,
    )
    expect(blocks).toEqual([])
  })

  it('inclut le premier instant de la semaine (borne inclusive) et exclut le premier instant de la suivante (borne exclusive)', () => {
    const blocks = toCalendarEventGridBlocks(
      [
        buildEvent({ id: 'evt-week-start', startAt: '2026-09-07T00:00:00.000Z', endAt: '2026-09-07T01:00:00.000Z' }),
        buildEvent({ id: 'evt-next-week-start', startAt: '2026-09-14T00:00:00.000Z', endAt: '2026-09-14T01:00:00.000Z' }),
      ],
      WEEK_START,
    )
    expect(blocks.map((block) => block.id)).toEqual(['evt-week-start'])
  })

  it('écarte les événements illisibles ou hors semaine, garde les autres', () => {
    const blocks = toCalendarEventGridBlocks(
      [
        buildEvent({ id: 'evt-ok' }),
        buildEvent({ id: 'evt-bad-date', startAt: 'nope' }),
        buildEvent({ id: 'evt-far-future', startAt: '2027-01-01T00:00:00.000Z', endAt: '2027-01-01T01:00:00.000Z' }),
      ],
      WEEK_START,
    )
    expect(blocks.map((block) => block.id)).toEqual(['evt-ok'])
  })
})
