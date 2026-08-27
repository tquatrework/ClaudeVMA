import { describe, it, expect } from 'vitest'
import {
  getMemoImageMaxSizeHint,
  getMemoImageTooLargeMessage,
  getMemoLoadErrorMessage,
  getMemoWriteErrorMessage,
  hasUnfilledMathPlaceholder,
  isMemoImageTooLarge,
  MEMO_IMAGE_MAX_BYTES,
} from '../../src/utils/memo'

describe('isMemoImageTooLarge', () => {
  it('refuse un fichier au-delà du plafond', () => {
    const file = { size: MEMO_IMAGE_MAX_BYTES + 1 } as File
    expect(isMemoImageTooLarge(file)).toBe(true)
  })

  it('accepte un fichier sous le plafond', () => {
    const file = { size: MEMO_IMAGE_MAX_BYTES - 1 } as File
    expect(isMemoImageTooLarge(file)).toBe(false)
  })
})

describe('getMemoImageMaxSizeHint', () => {
  it('affiche la limite en français, lisible', () => {
    expect(getMemoImageMaxSizeHint()).toContain('500 Ko')
  })
})

describe('getMemoImageTooLargeMessage', () => {
  it('cite la taille du fichier quand elle est connue', () => {
    const message = getMemoImageTooLargeMessage(600_000)
    expect(message).toContain('600')
    expect(message).toContain('500 Ko')
  })

  it('reste explicite quand la taille est inconnue', () => {
    expect(getMemoImageTooLargeMessage(null)).toContain('trop lourde')
  })
})

describe('getMemoWriteErrorMessage', () => {
  it('traduit un 413 en message de poids excessif', () => {
    const error = {
      response: { status: 413, data: { code: 'UPLOAD_FILE_TOO_LARGE', receivedBytes: 600_000 } },
    }
    expect(getMemoWriteErrorMessage(error)).toContain('600 Ko')
  })

  it('traduit un 403 en refus d\'autorisation', () => {
    expect(getMemoWriteErrorMessage({ response: { status: 403 } })).toMatch(/autorisé/)
  })

  it('traduit un 404 en introuvable', () => {
    expect(getMemoWriteErrorMessage({ response: { status: 404 } })).toMatch(/introuvable/)
  })

  it('applique un repli générique sur une erreur inconnue', () => {
    expect(getMemoWriteErrorMessage({})).toBeTruthy()
  })
})

describe('hasUnfilledMathPlaceholder', () => {
  it('détecte une case de gabarit MathLive non remplie (racine n-ième incomplète)', () => {
    const latex =
      'x^2=a,S=\\left\\lbrace\\sqrt[\\placeholder{}]{a};-\\sqrt[\\placeholder{}]{a}\\right\\rbrace'
    expect(hasUnfilledMathPlaceholder(latex)).toBe(true)
  })

  it('n\'est pas déclenché par une formule complète', () => {
    expect(hasUnfilledMathPlaceholder('x^2 + y^2 = z^2')).toBe(false)
    expect(hasUnfilledMathPlaceholder('\\sqrt[3]{a}')).toBe(false)
  })
})

describe('getMemoLoadErrorMessage', () => {
  it('traduit un 403 en absence de droit sur le mémo consulté', () => {
    expect(getMemoLoadErrorMessage({ response: { status: 403 } })).toMatch(/accès/i)
  })
})
