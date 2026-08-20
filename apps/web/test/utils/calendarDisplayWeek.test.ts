import { describe, it, expect } from 'vitest'
import {
  addWeeksUtc,
  combineDateAndTime,
  formatDisplayDayDate,
  formatWeekRangeLabel,
  getDisplayWeek,
  getMondayOfWeek,
  isRecurrenceStillActiveOnDate,
  isWithinRange,
} from '../../src/utils/calendarDisplayWeek'

describe('getMondayOfWeek', () => {
  it('renvoie le lundi de la semaine pour un jeudi', () => {
    const monday = getMondayOfWeek(new Date('2026-09-10T14:32:00.000Z')) // jeudi
    expect(monday.toISOString()).toBe('2026-09-07T00:00:00.000Z')
  })

  it('renvoie le même jour pour un lundi déjà à minuit', () => {
    const monday = getMondayOfWeek(new Date('2026-09-07T00:00:00.000Z'))
    expect(monday.toISOString()).toBe('2026-09-07T00:00:00.000Z')
  })

  it('remonte au lundi précédent pour un dimanche', () => {
    const monday = getMondayOfWeek(new Date('2026-09-13T23:00:00.000Z')) // dimanche
    expect(monday.toISOString()).toBe('2026-09-07T00:00:00.000Z')
  })
})

describe('addWeeksUtc', () => {
  it('avance de N semaines', () => {
    const start = new Date('2026-09-07T00:00:00.000Z')
    expect(addWeeksUtc(start, 1).toISOString()).toBe('2026-09-14T00:00:00.000Z')
  })

  it('recule avec un nombre négatif', () => {
    const start = new Date('2026-09-07T00:00:00.000Z')
    expect(addWeeksUtc(start, -1).toISOString()).toBe('2026-08-31T00:00:00.000Z')
  })
})

describe('getDisplayWeek', () => {
  it('renvoie 7 jours lundi → dimanche avec leur date réelle', () => {
    const week = getDisplayWeek(new Date('2026-09-10T00:00:00.000Z'))

    expect(week.weekStart.toISOString()).toBe('2026-09-07T00:00:00.000Z')
    expect(week.weekEnd.toISOString()).toBe('2026-09-14T00:00:00.000Z')
    expect(week.days).toHaveLength(7)
    expect(week.days[0]).toMatchObject({ dayOfWeek: 1 })
    expect(week.days[0].date.toISOString()).toBe('2026-09-07T00:00:00.000Z')
    expect(week.days[6]).toMatchObject({ dayOfWeek: 0 }) // dimanche en dernier
    expect(week.days[6].date.toISOString()).toBe('2026-09-13T00:00:00.000Z')
  })
})

describe('isWithinRange', () => {
  const start = new Date('2026-09-07T00:00:00.000Z')
  const end = new Date('2026-09-14T00:00:00.000Z')

  it('inclut la borne de début', () => {
    expect(isWithinRange('2026-09-07T00:00:00.000Z', start, end)).toBe(true)
  })

  it('exclut la borne de fin', () => {
    expect(isWithinRange('2026-09-14T00:00:00.000Z', start, end)).toBe(false)
  })

  it('renvoie faux pour une date illisible', () => {
    expect(isWithinRange('nope', start, end)).toBe(false)
  })
})

describe('formatDisplayDayDate', () => {
  it('formate JJ/MM', () => {
    expect(formatDisplayDayDate(new Date('2026-09-07T00:00:00.000Z'))).toBe('07/09')
  })
})

describe('formatWeekRangeLabel', () => {
  it('un seul mois : "Semaine du X au Y mois année"', () => {
    expect(formatWeekRangeLabel(new Date('2026-09-07T00:00:00.000Z'))).toBe(
      'Semaine du 7 au 13 septembre 2026',
    )
  })

  it('à cheval sur deux mois', () => {
    expect(formatWeekRangeLabel(new Date('2026-07-27T00:00:00.000Z'))).toBe(
      'Semaine du 27 juillet au 2 août 2026',
    )
  })
})

describe('combineDateAndTime', () => {
  it('combine un jour réel et une heure HH:mm en ISO UTC', () => {
    const result = combineDateAndTime(new Date('2026-09-07T00:00:00.000Z'), '09:15')
    expect(result).toBe('2026-09-07T09:15:00.000Z')
  })
})

describe('isRecurrenceStillActiveOnDate', () => {
  it('toujours actif pour NONE, quelle que soit la date de fin', () => {
    expect(
      isRecurrenceStillActiveOnDate('NONE', '2026-01-01T00:00:00.000Z', new Date('2026-09-07T00:00:00.000Z')),
    ).toBe(true)
  })

  it('toujours actif sans date de fin', () => {
    expect(isRecurrenceStillActiveOnDate('WEEKLY', null, new Date('2026-09-07T00:00:00.000Z'))).toBe(true)
  })

  it('actif tant que le jour affiché ne dépasse pas la date de fin', () => {
    expect(
      isRecurrenceStillActiveOnDate(
        'WEEKLY',
        '2026-09-07T00:00:00.000Z',
        new Date('2026-09-07T00:00:00.000Z'),
      ),
    ).toBe(true)
  })

  it('inactif une fois la date de fin dépassée', () => {
    expect(
      isRecurrenceStillActiveOnDate(
        'WEEKLY',
        '2026-09-07T00:00:00.000Z',
        new Date('2026-09-14T00:00:00.000Z'),
      ),
    ).toBe(false)
  })
})
