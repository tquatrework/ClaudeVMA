/**
 * Tests des helpers purs de la photo de profil (`src/utils/profileAvatar.ts`).
 *
 * Deux points sensibles y sont gardés :
 *
 * 1. le **jeton de version** `?v=`, sans lequel une photo remplacée reste
 *    affichée depuis le cache du navigateur ;
 * 2. la **traduction des erreurs en français**, en particulier le `413` que
 *    nginx renvoie aujourd'hui dès qu'une photo dépasse ~1 Mo : l'utilisateur
 *    doit lire un message qui parle de poids de fichier, jamais un code HTTP ni
 *    un message technique anglais du serveur.
 */

import { describe, it, expect } from 'vitest'
import {
  ACCEPTED_AVATAR_MIME_TYPES,
  AVATAR_FILE_INPUT_ACCEPT,
  extractAvatarVersionToken,
  getAvatarDeleteErrorMessage,
  getAvatarImageAlt,
  getAvatarLoadErrorMessage,
  getAvatarUploadErrorMessage,
} from '../../src/utils/profileAvatar'

/** Erreur de forme axios, telle que rejetée par `src/api/*`. */
function makeHttpError(status: number, message?: string) {
  return { response: { status, data: message ? { message } : undefined } }
}

describe('extractAvatarVersionToken', () => {
  it("lit le jeton `v` de l'URL renvoyée par le serveur", () => {
    expect(
      extractAvatarVersionToken('/api/v1/profiles/student-1/avatar?v=1754820000000'),
    ).toBe('1754820000000')
  })

  it('lit le jeton même accompagné d’autres paramètres', () => {
    expect(extractAvatarVersionToken('/api/v1/profiles/x/avatar?size=small&v=42')).toBe('42')
  })

  it("renvoie undefined quand il n'y a pas de jeton exploitable", () => {
    expect(extractAvatarVersionToken('/api/v1/profiles/x/avatar')).toBeUndefined()
    expect(extractAvatarVersionToken('/api/v1/profiles/x/avatar?v=')).toBeUndefined()
    expect(extractAvatarVersionToken('/api/v1/profiles/x/avatar?other=1')).toBeUndefined()
    expect(extractAvatarVersionToken(null)).toBeUndefined()
    expect(extractAvatarVersionToken(undefined)).toBeUndefined()
    expect(extractAvatarVersionToken('')).toBeUndefined()
  })
})

describe('getAvatarImageAlt', () => {
  it('nomme la personne quand son nom est connu', () => {
    expect(getAvatarImageAlt('Alice Martin')).toBe('Photo de profil de Alice Martin')
  })

  it("se contente d'un texte générique quand aucun nom n'est lisible", () => {
    // Jamais d'identifiant technique en repli : mieux vaut un texte générique
    // qu'un UUID lu par un lecteur d'écran.
    expect(getAvatarImageAlt(undefined)).toBe('Photo de profil')
    expect(getAvatarImageAlt(null)).toBe('Photo de profil')
    expect(getAvatarImageAlt('   ')).toBe('Photo de profil')
  })
})

describe('formats acceptés', () => {
  it("n'annonce ni SVG ni HEIC, refusés par le serveur", () => {
    expect(ACCEPTED_AVATAR_MIME_TYPES).not.toContain('image/svg+xml')
    expect(ACCEPTED_AVATAR_MIME_TYPES).not.toContain('image/heic')
    expect(AVATAR_FILE_INPUT_ACCEPT).toContain('image/jpeg')
    expect(AVATAR_FILE_INPUT_ACCEPT).toContain('image/webp')
  })
})

describe('getAvatarUploadErrorMessage', () => {
  it('parle du poids du fichier sur un 413, sans citer le code HTTP', () => {
    const message = getAvatarUploadErrorMessage(makeHttpError(413))

    expect(message).toContain('trop lourde')
    expect(message).toContain('1 Mo')
    expect(message).not.toContain('413')
  })

  it('traduit le 413 même quand le serveur web répond une page HTML', () => {
    // nginx coupe la requête en amont du service : aucun message métier
    // exploitable n'accompagne le statut.
    const nginxError = { response: { status: 413, data: '<html>413 Request Entity Too Large</html>' } }

    expect(getAvatarUploadErrorMessage(nginxError)).toContain('trop lourde')
  })

  it('explique les formats acceptés sur un 400, sans relayer le message anglais', () => {
    const message = getAvatarUploadErrorMessage(makeHttpError(400, 'Unsupported image format'))

    expect(message).toContain('JPEG')
    expect(message).toContain('SVG')
    expect(message).not.toContain('Unsupported')
  })

  it('dit que la photo appartient à son titulaire sur un 403', () => {
    expect(getAvatarUploadErrorMessage(makeHttpError(403))).toContain('titulaire')
  })

  it('reste sobre sur une panne serveur', () => {
    const message = getAvatarUploadErrorMessage(makeHttpError(500))

    expect(message).toContain('Réessayez')
    expect(message).not.toContain('500')
  })

  it('retombe sur la traduction générique pour une erreur réseau', () => {
    const networkError = { request: {}, message: 'Network Error' }

    expect(getAvatarUploadErrorMessage(networkError)).toContain('Impossible de contacter le serveur')
  })
})

describe('getAvatarDeleteErrorMessage', () => {
  it('dit que la photo appartient à son titulaire sur un 403', () => {
    expect(getAvatarDeleteErrorMessage(makeHttpError(403))).toContain('titulaire')
  })

  it('propose de réessayer, en français, sur une panne serveur', () => {
    // Repli sur la traduction générique d'`apiError` : elle reste en français et
    // ne laisse échapper ni code HTTP ni message technique.
    expect(getAvatarDeleteErrorMessage(makeHttpError(500))).toMatch(/réessayer/i)
  })
})

describe('getAvatarLoadErrorMessage', () => {
  it('parle du profil, pas de la photo, sur un 403', () => {
    // Un `403` porte sur le droit de lire le PROFIL ; le masquage de la seule
    // photo se traduit par un `404`, traité comme une absence.
    expect(getAvatarLoadErrorMessage(makeHttpError(403))).toContain('profil')
  })

  it("n'invente aucune cause sur une panne serveur", () => {
    const message = getAvatarLoadErrorMessage(makeHttpError(500))

    expect(message).toMatch(/réessayer/i)
    expect(message).not.toContain('500')
  })

  it('retombe sur un message dédié quand aucun statut ne renseigne la panne', () => {
    expect(getAvatarLoadErrorMessage(new Error('boom'))).toContain("n'a pas pu être affichée")
  })
})
