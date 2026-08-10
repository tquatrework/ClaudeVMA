/**
 * Tests de la mise en forme des tailles de fichier (`src/utils/fileSize.ts`).
 *
 * Deux pièges y sont gardés :
 *
 * 1. **l'unité** — le plafond serveur vaut exactement 1 000 000 octets ; en base
 *    1 024 il s'afficherait « 0,95 Mo », soit une limite annoncée différente de
 *    la limite appliquée ;
 * 2. **la taille inconnue** — le serveur renvoie `receivedBytes: null` quand le
 *    flux a été coupé. On doit lire « taille inconnue », jamais « 0 octet ».
 */

import { describe, it, expect } from 'vitest'
import { formatFileSize } from '../../src/utils/fileSize'

describe('formatFileSize', () => {
  it('annonce le plafond serveur comme exactement 1 Mo', () => {
    // Unités SI : la valeur affichée doit coïncider avec la valeur appliquée.
    expect(formatFileSize(1_000_000)).toBe('1 Mo')
  })

  it('arrondit une photo de téléphone à un chiffre après la virgule, à la française', () => {
    expect(formatFileSize(4_200_000)).toBe('4,2 Mo')
    expect(formatFileSize(8_450_000)).toBe('8,5 Mo')
  })

  it('bascule en kilo-octets sous le méga-octet', () => {
    expect(formatFileSize(512_000)).toBe('512 Ko')
    expect(formatFileSize(1_500)).toBe('2 Ko')
  })

  it("n'affiche jamais quatre chiffres en kilo-octets", () => {
    // 999 900 octets arrondiraient à « 1 000 Ko » : on promeut en méga-octets.
    expect(formatFileSize(999_900)).toBe('1 Mo')
  })

  it('reste en octets pour les tailles minuscules, au singulier près', () => {
    expect(formatFileSize(3)).toBe('3 octets')
    expect(formatFileSize(1)).toBe('1 octet')
    expect(formatFileSize(0)).toBe('0 octet')
  })

  it("renvoie null — et non « 0 octet » — quand la taille n'est pas connue", () => {
    // `receivedBytes: null` du serveur : annoncer un chiffre serait une invention.
    expect(formatFileSize(null)).toBeNull()
    expect(formatFileSize(undefined)).toBeNull()
    expect(formatFileSize(Number.NaN)).toBeNull()
    expect(formatFileSize(-1)).toBeNull()
  })
})
