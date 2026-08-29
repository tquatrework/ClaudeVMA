import { describe, it, expect } from 'vitest'
import {
  FALLBACK_QUIZ_IMPORT_CONSTRAINTS,
  getQuizImportBlockFallbackLabel,
  getQuizImportMaxSizeHint,
  getQuizImportTooLargeMessage,
  getQuizImportUploadErrorMessage,
  getQuizImportWrongExtensionMessage,
  hasAcceptedQuizImportExtension,
  isQuizImportFileTooLarge,
  normalizeQuizImportConstraints,
} from '../../src/utils/quizImport'

describe('hasAcceptedQuizImportExtension', () => {
  it('accepte .csv et .xlsx, insensible à la casse', () => {
    expect(hasAcceptedQuizImportExtension('quizzes.csv')).toBe(true)
    expect(hasAcceptedQuizImportExtension('quizzes.XLSX')).toBe(true)
  })

  it('refuse les autres extensions', () => {
    expect(hasAcceptedQuizImportExtension('quizzes.xls')).toBe(false)
    expect(hasAcceptedQuizImportExtension('quizzes.pdf')).toBe(false)
    expect(hasAcceptedQuizImportExtension('quizzes')).toBe(false)
  })
})

describe('getQuizImportWrongExtensionMessage', () => {
  it('cite le nom du fichier et les formats attendus', () => {
    const message = getQuizImportWrongExtensionMessage('quizzes.pdf')
    expect(message).toMatch(/quizzes\.pdf/)
    expect(message).toMatch(/\.csv/)
    expect(message).toMatch(/\.xlsx/)
  })
})

describe('isQuizImportFileTooLarge', () => {
  it('compare la taille du fichier au plafond', () => {
    const smallFile = new File([new Uint8Array(10)], 'small.csv')
    const bigFile = new File([new Uint8Array(2_000_000)], 'big.csv')
    expect(isQuizImportFileTooLarge(smallFile, 900_000)).toBe(false)
    expect(isQuizImportFileTooLarge(bigFile, 900_000)).toBe(true)
  })
})

describe('getQuizImportMaxSizeHint', () => {
  it('affiche une taille lisible et les formats acceptés', () => {
    const hint = getQuizImportMaxSizeHint(900_000)
    expect(hint).toMatch(/900 Ko/)
    expect(hint).toMatch(/\.csv/)
    expect(hint).toMatch(/\.xlsx/)
  })
})

describe('getQuizImportTooLargeMessage', () => {
  it('cite la taille du fichier et la limite quand les deux sont connues', () => {
    const message = getQuizImportTooLargeMessage(1_200_000, 900_000)
    expect(message).toMatch(/1,2 Mo/)
    expect(message).toMatch(/900 Ko/)
  })

  it("ne mentionne pas 0 octet quand la taille est inconnue", () => {
    const message = getQuizImportTooLargeMessage(null, 900_000)
    expect(message).not.toMatch(/0 octet/)
    expect(message).toMatch(/volumineux/)
  })
})

describe('normalizeQuizImportConstraints', () => {
  it('retombe sur le repli si le corps est inexploitable', () => {
    expect(normalizeQuizImportConstraints(null)).toEqual(FALLBACK_QUIZ_IMPORT_CONSTRAINTS)
    expect(normalizeQuizImportConstraints({ maxFileSizeBytes: 'beaucoup' })).toEqual(
      FALLBACK_QUIZ_IMPORT_CONSTRAINTS,
    )
  })

  it('reprend la valeur du serveur si elle est exploitable', () => {
    expect(normalizeQuizImportConstraints({ maxFileSizeBytes: 750_000 })).toEqual({
      maxFileSizeBytes: 750_000,
    })
  })
})

describe('getQuizImportUploadErrorMessage', () => {
  it('traduit un 413 en citant la limite connue', () => {
    const error = {
      response: { status: 413, data: { code: 'UPLOAD_FILE_TOO_LARGE', maxUploadBytes: 900_000 } },
    }
    const message = getQuizImportUploadErrorMessage(error, { attemptedFileSizeBytes: 1_500_000 })
    expect(message).toMatch(/900 Ko/)
  })

  it('traduit un 400 en message métier, pas le message technique du serveur', () => {
    const message = getQuizImportUploadErrorMessage({ response: { status: 400 } })
    expect(message).toMatch(/format/)
  })

  it('traduit un 403 en refus explicite', () => {
    const message = getQuizImportUploadErrorMessage({ response: { status: 403 } })
    expect(message).toMatch(/autorisé/)
  })
})

describe('getQuizImportBlockFallbackLabel', () => {
  it('numérote à partir de 1, pas de 0', () => {
    expect(getQuizImportBlockFallbackLabel(0)).toMatch(/n°1/)
    expect(getQuizImportBlockFallbackLabel(2)).toMatch(/n°3/)
  })
})
