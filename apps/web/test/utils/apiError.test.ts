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

  it('journalise (sans l\'afficher) un message de validation en tableau, plutôt que de l\'ignorer en silence', () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const message = getErrorMessage({
      response: {
        status: 400,
        data: { message: ['startTime must be a valid ISO 8601 date string'] },
      },
    })

    // L'écran reste sur le message générique sûr, jamais le jargon technique anglais.
    expect(message).toMatch(/vérifiez les informations saisies/i)
    expect(message).not.toMatch(/ISO 8601/)
    // Mais le détail est désormais visible en console pour le diagnostic.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('validation refusée'),
      expect.stringContaining('startTime must be a valid ISO 8601 date string'),
    )
  })
})

describe("getErrorMessage — libellés techniques anglais des gardes de rôle", () => {
  // Constaté contre la pile réelle le 2026-08-12 : `teacher-request-service` répond
  // `403 {"message":"You do not have the required role for this action"}`. Ce texte
  // n'apporte rien de plus que le code HTTP et ne doit jamais atteindre l'écran.
  it.each([
    'You do not have the required role for this action',
    'Insufficient role',
    'Forbidden',
    'Unauthorized',
  ])('remplace « %s » par le message français du code HTTP', (guardMessage) => {
    const message = getErrorMessage({
      response: { status: 403, data: { message: guardMessage } },
    })

    expect(message).toBe("Vous n'êtes pas autorisé à effectuer cette action.")
  })

  it('laisse passer un message métier français porté par le même code HTTP', () => {
    const businessMessage =
      'Un lien existe deja entre cet eleve et ce formateur, avec un statut de professeur principal different de celui demande.'

    expect(
      getErrorMessage({ response: { status: 409, data: { message: businessMessage } } }),
    ).toBe(businessMessage)
  })

  it("n'écrase pas un message métier contenant l'un de ces mots", () => {
    const businessMessage = "Cette action est interdite : la demande est deja cloturee."

    expect(
      getErrorMessage({ response: { status: 400, data: { message: businessMessage } } }),
    ).toBe(businessMessage)
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
