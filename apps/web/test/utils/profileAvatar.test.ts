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
  extractAvatarVersionToken,
  formatAcceptedImageFormats,
  getAvatarDeleteErrorMessage,
  getAvatarFormatsHint,
  getAvatarImageAlt,
  getAvatarLoadErrorMessage,
  getAvatarMaxSizeHint,
  getAvatarTooLargeMessage,
  getAvatarUploadErrorMessage,
} from '../../src/utils/profileAvatar'
import { ACCEPTED_AVATAR_MIME_TYPES } from '../../src/utils/profileAvatarConstraints'

/** Erreur de forme axios, telle que rejetée par `src/api/*`. */
function makeHttpError(status: number, message?: string) {
  return { response: { status, data: message ? { message } : undefined } }
}

/**
 * Corps `413` de `profile-service`, tel que documenté (`docs/routes.md`
 * § « Photo de profil », clés stables).
 */
function makeTooLargeError(overrides: Record<string, unknown> = {}) {
  return {
    response: {
      status: 413,
      data: {
        statusCode: 413,
        error: 'Payload Too Large',
        code: 'UPLOAD_FILE_TOO_LARGE',
        message: 'Uploaded file exceeds the maximum allowed size',
        maxUploadBytes: 1_000_000,
        receivedBytes: null,
        requestBodyBytes: 1_258_291,
        ...overrides,
      },
    },
  }
}

/** Fichier dont on force la taille, sans allouer les octets correspondants. */
function makePhotoFile(sizeInBytes: number): File {
  const file = new File([new Uint8Array([1, 2, 3])], 'photo.jpg', { type: 'image/jpeg' })
  Object.defineProperty(file, 'size', { value: sizeInBytes })
  return file
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

describe('contraintes annoncées avant le choix du fichier', () => {
  it('suit le serveur le jour où le plafond sera relevé, sans valeur en dur', () => {
    expect(getAvatarMaxSizeHint(8_000_000)).toBe('Taille maximale : 8 Mo.')
  })

  it('énumère les formats en français, et nomme un format inconnu du front', () => {
    expect(formatAcceptedImageFormats(ACCEPTED_AVATAR_MIME_TYPES)).toBe(
      'JPEG, PNG, WebP, GIF ou AVIF',
    )
    expect(formatAcceptedImageFormats(['image/jpeg'])).toBe('JPEG')
    // Le serveur peut en ajouter : mieux vaut l'annoncer que le faire disparaître.
    expect(formatAcceptedImageFormats(['image/jpeg', 'image/heif'])).toBe('JPEG ou HEIF')
  })

  it('formule les deux indications affichées avant le choix du fichier', () => {
    expect(getAvatarMaxSizeHint(1_000_000)).toBe('Taille maximale : 1 Mo.')
    expect(getAvatarFormatsHint(ACCEPTED_AVATAR_MIME_TYPES)).toBe(
      'Formats acceptés : JPEG, PNG, WebP, GIF ou AVIF.',
    )
  })
})

describe('getAvatarTooLargeMessage', () => {
  it('cite la taille du fichier ET la limite, toutes deux lisibles', () => {
    const message = getAvatarTooLargeMessage(4_200_000, 1_000_000)

    expect(message).toContain('pèse 4,2 Mo')
    expect(message).toContain('maximale est de 1 Mo')
    // Jamais d'octets bruts : « 4 200 000 » ne se compare à rien à l'œil nu.
    expect(message).not.toContain('4200000')
  })

  it("n'invente aucun chiffre quand la taille est inconnue", () => {
    const message = getAvatarTooLargeMessage(null, 1_000_000)

    expect(message).toContain('trop lourde')
    expect(message).not.toContain('0 octet')
  })

  it('dit quoi faire, pas seulement ce qui ne va pas', () => {
    expect(getAvatarTooLargeMessage(null, 1_000_000)).toMatch(/réduisez ou recadrez/i)
  })
})

describe('getAvatarUploadErrorMessage', () => {
  it('parle du poids du fichier sur un 413, sans citer le code HTTP', () => {
    const message = getAvatarUploadErrorMessage(makeHttpError(413))

    expect(message).toContain('trop lourde')
    expect(message).toContain('1 Mo')
    expect(message).not.toContain('413')
  })

  it('lit le plafond dans le corps du 413, jamais le message anglais', () => {
    const message = getAvatarUploadErrorMessage(makeTooLargeError({ maxUploadBytes: 2_000_000 }))

    expect(message).toContain('maximale est de 2 Mo')
    expect(message).not.toContain('Uploaded file exceeds')
  })

  it('cite `receivedBytes` quand le serveur a pu mesurer le fichier', () => {
    const message = getAvatarUploadErrorMessage(makeTooLargeError({ receivedBytes: 4_500_000 }))

    expect(message).toContain('pèse 4,5 Mo')
  })

  it("n'affiche pas « 0 octet » quand `receivedBytes` vaut null", () => {
    // Flux coupé par multer : le fichier n'a jamais été reçu en entier.
    const message = getAvatarUploadErrorMessage(makeTooLargeError())

    expect(message).not.toContain('0 octet')
    expect(message).toContain('trop lourde')
  })

  it("ne cite pas la taille du fichier tenté quand elle n'explique pas le refus", () => {
    // Un fichier de 3 octets refusé en 413 vient d'autre chose (proxy, en-têtes) :
    // afficher « pèse 3 octets » face à « maximum 1 Mo » ferait douter du message.
    const message = getAvatarUploadErrorMessage(makeTooLargeError(), {
      attemptedFileSizeBytes: 3,
    })

    expect(message).not.toContain('3 octets')
    expect(message).toContain('trop lourde')
  })

  it('reconnaît le refus au `code` même sans statut 413', () => {
    const error = { response: { status: 400, data: { code: 'UPLOAD_FILE_TOO_LARGE' } } }

    expect(getAvatarUploadErrorMessage(error)).toContain('trop lourde')
  })

  it('traduit le 413 même quand le serveur web répond une page HTML', () => {
    // nginx coupe la requête en amont du service : aucun message métier
    // exploitable n'accompagne le statut, et `JSON.parse` échouerait.
    const nginxError = { response: { status: 413, data: '<html>413 Request Entity Too Large</html>' } }

    // Sans aucun contexte : message générique, en français, jamais la page HTML.
    expect(getAvatarUploadErrorMessage(nginxError)).toContain('trop lourde')
    expect(getAvatarUploadErrorMessage(nginxError)).not.toContain('<html>')

    // Avec le contexte connu du front : on reste sur le même message, enrichi de
    // la taille du fichier tenté puisqu'elle explique le refus.
    const contextualMessage = getAvatarUploadErrorMessage(nginxError, {
      maxUploadBytes: 1_000_000,
      attemptedFileSizeBytes: 4_200_000,
    })
    expect(contextualMessage).toContain('pèse 4,2 Mo')
    expect(contextualMessage).toContain('maximale est de 1 Mo')
  })

  it('accepte un corps de 413 sérialisé en chaîne JSON', () => {
    const stringifiedError = {
      response: {
        status: 413,
        data: JSON.stringify({ code: 'UPLOAD_FILE_TOO_LARGE', maxUploadBytes: 2_000_000 }),
      },
    }

    expect(getAvatarUploadErrorMessage(stringifiedError)).toContain('maximale est de 2 Mo')
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
