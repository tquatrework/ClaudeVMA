import { describe, it, expect } from 'vitest'
import {
  absoluteQuarterIndex,
  formatQuarterTime,
  quarterIndexToTime,
} from '../../src/utils/calendarQuarterHour'

describe('formatQuarterTime', () => {
  it('formate heure + quart en HH:mm', () => {
    expect(formatQuarterTime(9, 0)).toBe('09:00')
    expect(formatQuarterTime(9, 1)).toBe('09:15')
    expect(formatQuarterTime(9, 2)).toBe('09:30')
    expect(formatQuarterTime(9, 3)).toBe('09:45')
  })
})

describe('absoluteQuarterIndex', () => {
  it('calcule un index absolu depuis le début de la grille', () => {
    expect(absoluteQuarterIndex(7, 0, 7)).toBe(0)
    expect(absoluteQuarterIndex(7, 1, 7)).toBe(1)
    expect(absoluteQuarterIndex(8, 0, 7)).toBe(4)
    expect(absoluteQuarterIndex(9, 2, 7)).toBe(10)
  })
})

describe('quarterIndexToTime', () => {
  it('convertit un index absolu en HH:mm', () => {
    expect(quarterIndexToTime(0, 7)).toBe('07:00')
    expect(quarterIndexToTime(1, 7)).toBe('07:15')
    expect(quarterIndexToTime(4, 7)).toBe('08:00')
    expect(quarterIndexToTime(10, 7)).toBe('09:30')
  })

  it('est l\'inverse d\'absoluteQuarterIndex', () => {
    const index = absoluteQuarterIndex(14, 3, 7)
    expect(quarterIndexToTime(index, 7)).toBe('14:45')
  })
})
