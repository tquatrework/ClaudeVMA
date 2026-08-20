import { describe, it, expect } from 'vitest'
import {
  fromDateTimeLocalValue,
  toDateTimeLocalValue,
} from '../../src/utils/calendarDateTimeLocal'

describe('toDateTimeLocalValue', () => {
  it('convertit un ISO UTC en valeur datetime-local, sans reconversion de fuseau', () => {
    expect(toDateTimeLocalValue('2026-09-07T09:15:00.000Z')).toBe('2026-09-07T09:15')
  })

  it('renvoie une chaîne vide pour une date illisible', () => {
    expect(toDateTimeLocalValue('nope')).toBe('')
  })
})

describe('fromDateTimeLocalValue', () => {
  it('convertit une valeur datetime-local en ISO UTC', () => {
    expect(fromDateTimeLocalValue('2026-09-07T09:15')).toBe('2026-09-07T09:15:00.000Z')
  })

  it('renvoie null pour une valeur mal formée', () => {
    expect(fromDateTimeLocalValue('')).toBeNull()
    expect(fromDateTimeLocalValue('2026-09-07')).toBeNull()
  })

  it('est l\'inverse de toDateTimeLocalValue', () => {
    const iso = '2026-09-07T14:30:00.000Z'
    expect(fromDateTimeLocalValue(toDateTimeLocalValue(iso))).toBe(iso)
  })
})
