import { describe, it, expect } from 'vitest'
import {
  getAttachmentDeleteErrorMessage,
  getAttachmentDownloadErrorMessage,
  getAttachmentLoadErrorMessage,
  getAttachmentMaxSizeHint,
  getAttachmentTooLargeMessage,
  getAttachmentTotalSizeExceededMessage,
  getAttachmentUploadErrorMessage,
  isAttachmentTotalSizeExceededError,
  isAttachmentUploadTooLargeError,
} from '../../src/utils/logAttachment'

describe('getAttachmentMaxSizeHint', () => {
  it('affiche une taille lisible, pas des octets bruts', () => {
    expect(getAttachmentMaxSizeHint(100_000)).toBe('Taille maximale par fichier : 100 Ko.')
  })
})

describe('isAttachmentUploadTooLargeError / isAttachmentTotalSizeExceededError', () => {
  it('reconnaît UPLOAD_FILE_TOO_LARGE', () => {
    const error = { response: { status: 413, data: { code: 'UPLOAD_FILE_TOO_LARGE' } } }
    expect(isAttachmentUploadTooLargeError(error)).toBe(true)
    expect(isAttachmentTotalSizeExceededError(error)).toBe(false)
  })

  it('reconnaît UPLOAD_TOTAL_SIZE_EXCEEDED', () => {
    const error = { response: { status: 413, data: { code: 'UPLOAD_TOTAL_SIZE_EXCEEDED' } } }
    expect(isAttachmentUploadTooLargeError(error)).toBe(true)
    expect(isAttachmentTotalSizeExceededError(error)).toBe(true)
  })

  it('un 413 sans code reconnu n\'est pas classé comme poids excessif', () => {
    const error = { response: { status: 413, data: {} } }
    expect(isAttachmentUploadTooLargeError(error)).toBe(false)
  })

  it('un statut différent de 413 n\'est jamais un refus de poids', () => {
    expect(isAttachmentUploadTooLargeError({ response: { status: 400 } })).toBe(false)
  })
})

describe('getAttachmentTooLargeMessage', () => {
  it('cite la taille du fichier et la limite quand les deux sont connues', () => {
    const message = getAttachmentTooLargeMessage(145_000, 100_000)
    expect(message).toMatch(/145 Ko/)
    expect(message).toMatch(/100 Ko/)
  })

  it('ne mentionne pas 0 octet quand la taille est inconnue', () => {
    const message = getAttachmentTooLargeMessage(null, 100_000)
    expect(message).not.toMatch(/0 octet/)
    expect(message).toMatch(/trop lourd/)
  })
})

describe('getAttachmentTotalSizeExceededMessage', () => {
  it('cite le plafond total et invite à supprimer une pièce jointe', () => {
    const message = getAttachmentTotalSizeExceededMessage(5_000_000)
    expect(message).toMatch(/5 Mo/)
    expect(message).toMatch(/supprimez/i)
  })
})

describe('getAttachmentUploadErrorMessage', () => {
  it('distingue UPLOAD_FILE_TOO_LARGE de UPLOAD_TOTAL_SIZE_EXCEEDED', () => {
    const fileTooLarge = getAttachmentUploadErrorMessage({
      response: {
        status: 413,
        data: { code: 'UPLOAD_FILE_TOO_LARGE', maxUploadBytes: 100_000, receivedBytes: 200_000 },
      },
    })
    expect(fileTooLarge).toMatch(/fichier plus léger/)

    const totalExceeded = getAttachmentUploadErrorMessage(
      { response: { status: 413, data: { code: 'UPLOAD_TOTAL_SIZE_EXCEEDED' } } },
      { maxTotalBytesPerEntry: 5_000_000 },
    )
    expect(totalExceeded).toMatch(/total des pièces jointes/)
  })

  it('400 → message de format non reconnu', () => {
    expect(getAttachmentUploadErrorMessage({ response: { status: 400 } })).toMatch(/format/i)
  })

  it('403 → message de droit ou désactivation', () => {
    expect(getAttachmentUploadErrorMessage({ response: { status: 403 } })).toMatch(/autorisé/i)
  })

  it('404 → entrée introuvable', () => {
    expect(getAttachmentUploadErrorMessage({ response: { status: 404 } })).toMatch(/introuvable/i)
  })
})

describe('getAttachmentDeleteErrorMessage', () => {
  it('403 → message dédié', () => {
    expect(getAttachmentDeleteErrorMessage({ response: { status: 403 } })).toMatch(/autorisé/i)
  })
})

describe('getAttachmentLoadErrorMessage / getAttachmentDownloadErrorMessage', () => {
  it('403 → accès refusé', () => {
    expect(getAttachmentLoadErrorMessage({ response: { status: 403 } })).toMatch(/accès/i)
    expect(getAttachmentDownloadErrorMessage({ response: { status: 403 } })).toMatch(/accès/i)
  })
})
