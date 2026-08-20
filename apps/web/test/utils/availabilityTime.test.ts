import { describe, it, expect } from 'vitest'
import {
  addOneHourToTime,
  computeVerticalPosition,
  doRangesOverlap,
  formatTimeRangeLabel,
  isStartBeforeEnd,
  isValidTimeString,
  timeToMinutes,
} from '../../src/utils/availabilityTime'

describe('isValidTimeString', () => {
  it('accepte une heure valide', () => {
    expect(isValidTimeString('09:00')).toBe(true)
    expect(isValidTimeString('23:59')).toBe(true)
    expect(isValidTimeString('00:00')).toBe(true)
  })

  it('refuse une heure invalide', () => {
    expect(isValidTimeString('24:00')).toBe(false)
    expect(isValidTimeString('9:00')).toBe(false)
    expect(isValidTimeString('09:60')).toBe(false)
    expect(isValidTimeString('')).toBe(false)
    expect(isValidTimeString('not-a-time')).toBe(false)
  })
})

describe('isStartBeforeEnd', () => {
  it('vrai quand le début précède la fin', () => {
    expect(isStartBeforeEnd('09:00', '10:00')).toBe(true)
  })

  it('faux quand le début est après ou égal à la fin', () => {
    expect(isStartBeforeEnd('10:00', '09:00')).toBe(false)
    expect(isStartBeforeEnd('09:00', '09:00')).toBe(false)
  })

  it('faux si l\'une des deux heures est invalide', () => {
    expect(isStartBeforeEnd('bad', '10:00')).toBe(false)
    expect(isStartBeforeEnd('09:00', 'bad')).toBe(false)
  })
})

describe('doRangesOverlap', () => {
  it('détecte un chevauchement sur le même jour', () => {
    expect(
      doRangesOverlap(
        { dayOfWeek: 1, startTime: '09:00', endTime: '11:00' },
        { dayOfWeek: 1, startTime: '10:00', endTime: '12:00' },
      ),
    ).toBe(true)
  })

  it('ne détecte aucun chevauchement sur des jours différents', () => {
    expect(
      doRangesOverlap(
        { dayOfWeek: 1, startTime: '09:00', endTime: '11:00' },
        { dayOfWeek: 2, startTime: '09:00', endTime: '11:00' },
      ),
    ).toBe(false)
  })

  it('ne détecte aucun chevauchement quand les créneaux se touchent sans se recouvrir', () => {
    expect(
      doRangesOverlap(
        { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
        { dayOfWeek: 1, startTime: '10:00', endTime: '11:00' },
      ),
    ).toBe(false)
  })
})

describe('timeToMinutes', () => {
  it('convertit une heure en minutes depuis minuit', () => {
    expect(timeToMinutes('00:00')).toBe(0)
    expect(timeToMinutes('09:30')).toBe(570)
    expect(timeToMinutes('23:59')).toBe(1439)
  })

  it('renvoie null pour une heure invalide', () => {
    expect(timeToMinutes('bad')).toBeNull()
  })
})

describe('computeVerticalPosition', () => {
  it('positionne un créneau au début de la grille (07:00) à 0%', () => {
    const { topPercent } = computeVerticalPosition('07:00', '08:00')
    expect(topPercent).toBe(0)
  })

  it('positionne un créneau couvrant la moitié de la grille à 50% de hauteur', () => {
    // Grille 07:00-22:00 = 15h. 07:00-14:30 = 7h30 = 50%.
    const { heightPercent } = computeVerticalPosition('07:00', '14:30')
    expect(heightPercent).toBeCloseTo(50, 0)
  })

  it('écrête les bornes hors de la plage 07:00-22:00', () => {
    const { topPercent, heightPercent } = computeVerticalPosition('05:00', '23:00')
    expect(topPercent).toBe(0)
    expect(heightPercent).toBe(100)
  })
})

describe('formatTimeRangeLabel', () => {
  it('formate une plage horaire lisible', () => {
    expect(formatTimeRangeLabel('09:00', '12:00')).toBe('09:00 – 12:00')
  })
})

describe('addOneHourToTime', () => {
  it('ajoute une heure à une heure valide', () => {
    expect(addOneHourToTime('09:00')).toBe('10:00')
    expect(addOneHourToTime('09:30')).toBe('10:30')
  })

  it('repasse à 00:xx après 23:xx (modulo 24h)', () => {
    expect(addOneHourToTime('23:15')).toBe('00:15')
  })

  it('renvoie la valeur inchangée si invalide', () => {
    expect(addOneHourToTime('bad')).toBe('bad')
  })
})
