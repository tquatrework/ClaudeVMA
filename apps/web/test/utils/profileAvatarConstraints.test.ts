/**
 * Tests du contrat de contraintes d'envoi
 * (`src/utils/profileAvatarConstraints.ts`).
 *
 * Ce qui est gardé ici, c'est l'engagement pris dans `docs/routes.md` : **aucune
 * de ces valeurs n'est codée en dur côté front**. Le jour où le plafond du
 * reverse-proxy sera relevé, la limite annoncée et le contrôle local doivent
 * suivre le serveur sans modification du front — et si l'appel échoue, le repli
 * doit rester exploitable plutôt que de produire une comparaison à `undefined`,
 * qui n'aurait refusé aucun fichier.
 */

import { describe, it, expect } from 'vitest'
import {
  ACCEPTED_AVATAR_MIME_TYPES,
  AVATAR_FILE_INPUT_ACCEPT,
  FALLBACK_AVATAR_CONSTRAINTS,
  buildAvatarFileInputAccept,
  isAvatarFileTooLarge,
  normalizeAvatarConstraints,
  readPositiveNumber,
} from '../../src/utils/profileAvatarConstraints'

/** Fichier dont on force la taille, sans allouer les octets correspondants. */
function makePhotoFile(sizeInBytes: number): File {
  const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })
  Object.defineProperty(file, 'size', { value: sizeInBytes })
  return file
}

describe('formats acceptés', () => {
  it("n'annonce ni SVG ni HEIC, refusés par le serveur", () => {
    expect(ACCEPTED_AVATAR_MIME_TYPES).not.toContain('image/svg+xml')
    expect(ACCEPTED_AVATAR_MIME_TYPES).not.toContain('image/heic')
    expect(AVATAR_FILE_INPUT_ACCEPT).toContain('image/jpeg')
    expect(AVATAR_FILE_INPUT_ACCEPT).toContain('image/webp')
  })

  it("construit l'attribut `accept` à partir des types annoncés par le serveur", () => {
    expect(buildAvatarFileInputAccept(['image/jpeg', 'image/png'])).toBe('image/jpeg,image/png')
  })
})

describe('normalizeAvatarConstraints', () => {
  it('reprend telles quelles les valeurs du serveur', () => {
    const constraints = normalizeAvatarConstraints({
      maxUploadBytes: 1_000_000,
      acceptedContentTypes: ['image/jpeg', 'image/png'],
      outputContentType: 'image/webp',
      maxDimensionPixels: 512,
    })

    expect(constraints.maxUploadBytes).toBe(1_000_000)
    expect(constraints.acceptedContentTypes).toEqual(['image/jpeg', 'image/png'])
  })

  it('suit le serveur le jour où le plafond sera relevé, sans valeur en dur', () => {
    expect(normalizeAvatarConstraints({ maxUploadBytes: 8_000_000 }).maxUploadBytes).toBe(
      8_000_000,
    )
  })

  it('se replie champ par champ sur un corps inexploitable', () => {
    // Sans ce garde-fou, chaque fichier serait comparé à `undefined`, donc
    // aucun ne serait refusé localement, et l'écran annoncerait « NaN Mo ».
    expect(normalizeAvatarConstraints({ maxUploadBytes: 'beaucoup' })).toEqual(
      FALLBACK_AVATAR_CONSTRAINTS,
    )
    expect(normalizeAvatarConstraints(null)).toEqual(FALLBACK_AVATAR_CONSTRAINTS)
    expect(normalizeAvatarConstraints(undefined).maxUploadBytes).toBe(1_000_000)
    expect(normalizeAvatarConstraints({ acceptedContentTypes: [] }).acceptedContentTypes).toEqual(
      FALLBACK_AVATAR_CONSTRAINTS.acceptedContentTypes,
    )
  })
})

describe('readPositiveNumber', () => {
  it('accepte un nombre exploitable, rejette tout le reste', () => {
    expect(readPositiveNumber(1_000_000)).toBe(1_000_000)
    // `receivedBytes: null` du serveur, valeurs textuelles, zéro, NaN.
    expect(readPositiveNumber(null)).toBeNull()
    expect(readPositiveNumber(undefined)).toBeNull()
    expect(readPositiveNumber('1000000')).toBeNull()
    expect(readPositiveNumber(0)).toBeNull()
    expect(readPositiveNumber(Number.NaN)).toBeNull()
  })
})

describe('isAvatarFileTooLarge', () => {
  it('refuse au-delà du plafond, accepte pile dessus', () => {
    expect(isAvatarFileTooLarge(makePhotoFile(1_000_001), 1_000_000)).toBe(true)
    expect(isAvatarFileTooLarge(makePhotoFile(1_000_000), 1_000_000)).toBe(false)
    expect(isAvatarFileTooLarge(makePhotoFile(4_200_000), 1_000_000)).toBe(true)
  })

  it('suit le plafond du serveur plutôt qu’une constante', () => {
    expect(isAvatarFileTooLarge(makePhotoFile(4_200_000), 8_000_000)).toBe(false)
  })
})
