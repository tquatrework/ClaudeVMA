/**
 * Tests de la traduction des erreurs serveur en message lisible.
 *
 * Point sensible couvert ici : le `400` « champs inconnus » renvoyé par
 * identity-access-service depuis le 2026-08-09. Son message est technique et en
 * anglais (noms de champs, liste des champs acceptés) — il ne doit jamais atteindre
 * l'écran, et l'utilisateur doit recevoir une consigne actionnable à la place.
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  getErrorMessage,
  getErrorStatus,
  isUnknownFieldsRejection,
  readBackendMessage,
} from '../../src/utils/apiError'

const UNKNOWN_FIELDS_ERROR = {
  response: {
    status: 400,
    data: {
      message:
        'Unknown field(s): birthDate. Accepted fields for this route: email, password, firstName, lastName, consents.',
    },
  },
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('readBackendMessage', () => {
  it('lit un message serveur sous forme de chaîne', () => {
    expect(readBackendMessage({ response: { data: { message: 'Email déjà utilisé' } } })).toBe(
      'Email déjà utilisé',
    )
  })

  it('concatène un message serveur sous forme de tableau de violations', () => {
    const error = { response: { data: { message: ['email must be an email', 'password too short'] } } }

    expect(readBackendMessage(error)).toBe('email must be an email password too short')
  })

  it('retourne une chaîne vide quand aucun message n\'est exploitable', () => {
    expect(readBackendMessage({ response: { data: {} } })).toBe('')
    expect(readBackendMessage(undefined)).toBe('')
  })
})

describe('isUnknownFieldsRejection', () => {
  it('reconnaît le refus de champs inconnus (message en chaîne)', () => {
    expect(isUnknownFieldsRejection(UNKNOWN_FIELDS_ERROR)).toBe(true)
  })

  it('reconnaît le refus de champs inconnus (message en tableau)', () => {
    const error = {
      response: {
        status: 400,
        data: { message: ['Unknown field(s): parentConsents.', 'Accepted fields for this route: …'] },
      },
    }

    expect(isUnknownFieldsRejection(error)).toBe(true)
  })

  it('ne confond pas un 400 de validation métier avec un refus de champs inconnus', () => {
    const error = {
      response: { status: 400, data: { message: ['parentEmail should not exist'] } },
    }

    expect(isUnknownFieldsRejection(error)).toBe(false)
  })

  it('ignore les statuts autres que 400', () => {
    const error = {
      response: { status: 409, data: { message: 'Accepted fields for this route: …' } },
    }

    expect(isUnknownFieldsRejection(error)).toBe(false)
  })

  it('ne casse pas sur une erreur réseau sans réponse', () => {
    expect(isUnknownFieldsRejection({ request: {} })).toBe(false)
    expect(isUnknownFieldsRejection(new Error('boom'))).toBe(false)
  })
})

describe('getErrorMessage', () => {
  it('remplace le détail technique du 400 « champs inconnus » par une consigne', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const message = getErrorMessage(UNKNOWN_FIELDS_ERROR)

    expect(message).toMatch(/n'est plus à jour avec le serveur/i)
    expect(message).not.toMatch(/birthDate/)
    expect(message).not.toMatch(/Accepted fields/)
  })

  it('journalise le détail technique pour le développeur', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    getErrorMessage(UNKNOWN_FIELDS_ERROR)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('champs refusés'),
      expect.stringContaining('birthDate'),
    )
  })

  it('privilégie le message métier du serveur dans les autres cas', () => {
    expect(
      getErrorMessage({ response: { status: 409, data: { message: 'Identifiant déjà pris' } } }),
    ).toBe('Identifiant déjà pris')
  })

  it('retombe sur le message par défaut du statut HTTP', () => {
    expect(getErrorMessage({ response: { status: 403, data: {} } })).toMatch(/pas autorisé/i)
  })

  it('signale une erreur réseau sans réponse', () => {
    expect(getErrorMessage({ request: {} })).toMatch(/impossible de contacter le serveur/i)
  })

  it('utilise le fallback fourni quand rien d\'autre n\'est exploitable', () => {
    expect(getErrorMessage({}, 'Impossible de créer le compte.')).toBe(
      'Impossible de créer le compte.',
    )
  })
})

describe('getErrorStatus', () => {
  it('extrait le statut HTTP quand il existe', () => {
    expect(getErrorStatus({ response: { status: 404 } })).toBe(404)
  })

  it('retourne undefined sans réponse HTTP', () => {
    expect(getErrorStatus(new Error('boom'))).toBeUndefined()
  })
})
