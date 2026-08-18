import { describe, it, expect } from 'vitest'
import {
  extractDayOfWeekFromIso,
  toBusyFreeGridBlock,
  toBusyFreeGridBlocks,
} from '../../src/utils/linkedCalendarBusyFree'

describe('extractDayOfWeekFromIso', () => {
  it('extrait le jour de semaine UTC (0 dimanche … 6 samedi)', () => {
    // 2026-09-10 est un jeudi.
    expect(extractDayOfWeekFromIso('2026-09-10T09:00:00.000Z')).toBe(4)
  })

  it('renvoie null pour une date invalide', () => {
    expect(extractDayOfWeekFromIso('not-a-date')).toBeNull()
  })
})

describe('toBusyFreeGridBlock', () => {
  it('traduit un bloc busy/free vers la forme attendue par AvailabilityGrid', () => {
    const result = toBusyFreeGridBlock(
      { start: '2026-09-10T09:00:00.000Z', end: '2026-09-10T11:00:00.000Z' },
      'AVAILABLE',
      0,
    )

    expect(result).toEqual({
      id: 'AVAILABLE-0-2026-09-10T09:00:00.000Z',
      dayOfWeek: 4,
      startTime: '09:00',
      endTime: '11:00',
      kind: 'AVAILABLE',
    })
  })

  it('écrête visuellement à 23:59 un bloc qui chevauche minuit', () => {
    const result = toBusyFreeGridBlock(
      { start: '2026-09-10T22:00:00.000Z', end: '2026-09-11T01:00:00.000Z' },
      'BUSY',
      0,
    )

    expect(result).toMatchObject({ dayOfWeek: 4, startTime: '22:00', endTime: '23:59' })
  })

  it('renvoie null si "start" est illisible', () => {
    const result = toBusyFreeGridBlock({ start: 'invalid', end: '2026-09-10T11:00:00.000Z' }, 'BUSY', 0)
    expect(result).toBeNull()
  })
})

describe('toBusyFreeGridBlocks', () => {
  it('traduit une liste et écarte les blocs illisibles', () => {
    const result = toBusyFreeGridBlocks(
      [
        { start: '2026-09-10T09:00:00.000Z', end: '2026-09-10T11:00:00.000Z' },
        { start: 'invalid', end: '2026-09-10T11:00:00.000Z' },
      ],
      'UNAVAILABLE',
    )

    expect(result).toHaveLength(1)
    expect(result[0].kind).toBe('UNAVAILABLE')
  })

  it('renvoie une liste vide pour une entrée vide', () => {
    expect(toBusyFreeGridBlocks([], 'BUSY')).toEqual([])
  })
})
