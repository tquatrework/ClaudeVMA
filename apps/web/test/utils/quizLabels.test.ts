import { describe, it, expect } from 'vitest'
import { toQuizScore, formatQuizScore } from '../../src/utils/quizLabels'

describe('toQuizScore', () => {
  it('renvoie null pour null/undefined', () => {
    expect(toQuizScore(null)).toBeNull()
    expect(toQuizScore(undefined)).toBeNull()
  })

  it('renvoie le nombre tel quel', () => {
    expect(toQuizScore(6)).toBe(6)
    expect(toQuizScore(-2.5)).toBe(-2.5)
  })

  it('parse une chaîne décimale (historique, sérialisation Postgres)', () => {
    expect(toQuizScore('6.00')).toBe(6)
    expect(toQuizScore('-1.50')).toBe(-1.5)
  })

  it('renvoie null pour une chaîne non numérique', () => {
    expect(toQuizScore('abc')).toBeNull()
  })
})

describe('formatQuizScore', () => {
  it("affiche un tiret pour l'absence de score", () => {
    expect(formatQuizScore(null)).toBe('—')
    expect(formatQuizScore(undefined)).toBe('—')
  })

  it('affiche un entier sans décimales', () => {
    expect(formatQuizScore(6)).toBe('6')
    expect(formatQuizScore('6.00')).toBe('6')
  })

  it('affiche un score négatif sans le masquer (pénalités)', () => {
    expect(formatQuizScore(-2)).toBe('-2')
    expect(formatQuizScore('-1.50')).toBe('-1.50')
  })

  it('arrondit à deux décimales un score non entier', () => {
    expect(formatQuizScore(1.5)).toBe('1.50')
  })
})
