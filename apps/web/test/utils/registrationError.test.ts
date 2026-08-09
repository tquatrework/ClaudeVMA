/**
 * Tests for registrationError utils
 *
 * `POST /accounts/students` and `POST /accounts/parents` may create two accounts in one
 * call, so an error must say *which* account it is about.
 *
 * Covers:
 * - buildRegistrationErrorContext: derives the context from the payload actually sent
 * - resolveConflictingAccount: main / linked / unknown on a 409
 * - getRegistrationErrorMessage: 409 (both accounts), 404 (unknown account to attach),
 *   400 (inconsistent linked fields), and fallback to the generic mapping
 */

import { describe, it, expect } from 'vitest'
import {
  buildRegistrationErrorContext,
  getRegistrationErrorMessage,
  resolveConflictingAccount,
  type RegistrationErrorContext,
} from '../../src/utils/registrationError'

function httpError(status: number, message?: string | string[]) {
  return { response: { status, data: message === undefined ? {} : { message } } }
}

const NEW_LINKED_PARENT: RegistrationErrorContext = {
  relation: 'parent',
  linkedAccountMode: 'new',
  mainLoginIdentifier: 'lucas.martin',
  linkedLoginIdentifier: 'marie.dupont',
}

describe('buildRegistrationErrorContext', () => {
  it('reads the parent linking intent from a student registration payload', () => {
    expect(
      buildRegistrationErrorContext('parent', {
        loginIdentifier: 'lucas.martin',
        parentAccountMode: 'new',
        parentLoginIdentifier: 'marie.dupont',
      }),
    ).toEqual(NEW_LINKED_PARENT)
  })

  it('reads the student linking intent from a parent registration payload', () => {
    expect(
      buildRegistrationErrorContext('student', {
        loginIdentifier: 'marie.dupont',
        studentAccountMode: 'existing',
        studentLoginIdentifier: 'lucas.martin',
      }),
    ).toEqual({
      relation: 'student',
      linkedAccountMode: 'existing',
      mainLoginIdentifier: 'marie.dupont',
      linkedLoginIdentifier: 'lucas.martin',
    })
  })

  it('falls back to the "none" mode when no linking field was sent', () => {
    const context = buildRegistrationErrorContext('parent', { loginIdentifier: 'lucas.martin' })
    expect(context.linkedAccountMode).toBe('none')
    expect(context.linkedLoginIdentifier).toBeUndefined()
  })
})

describe('resolveConflictingAccount', () => {
  it('blames the main account when no linked account is created', () => {
    expect(
      resolveConflictingAccount(httpError(409), {
        relation: 'parent',
        linkedAccountMode: 'none',
        mainLoginIdentifier: 'lucas.martin',
      }),
    ).toBe('main')
  })

  it('blames the main account when a pre-existing account is merely attached', () => {
    expect(
      resolveConflictingAccount(httpError(409), {
        relation: 'parent',
        linkedAccountMode: 'existing',
        mainLoginIdentifier: 'lucas.martin',
        linkedLoginIdentifier: 'marie.dupont',
      }),
    ).toBe('main')
  })

  it('blames the linked account when the main identifier was left to the server', () => {
    expect(
      resolveConflictingAccount(httpError(409), {
        relation: 'parent',
        linkedAccountMode: 'new',
        mainLoginIdentifier: '',
        linkedLoginIdentifier: 'marie.dupont',
      }),
    ).toBe('linked')
  })

  it('blames the linked account when the server message quotes its identifier', () => {
    const error = httpError(409, "L'identifiant marie.dupont est déjà utilisé")
    expect(resolveConflictingAccount(error, NEW_LINKED_PARENT)).toBe('linked')
  })

  it('blames the main account when the server message quotes the main identifier', () => {
    const error = httpError(409, "L'identifiant lucas.martin est déjà utilisé")
    expect(resolveConflictingAccount(error, NEW_LINKED_PARENT)).toBe('main')
  })

  it('blames the linked account when the server message names the linked field', () => {
    const error = httpError(409, 'parentLoginIdentifier already taken')
    expect(resolveConflictingAccount(error, NEW_LINKED_PARENT)).toBe('linked')
  })

  it('does not guess when the server message carries no usable signal', () => {
    expect(resolveConflictingAccount(httpError(409, 'Conflict'), NEW_LINKED_PARENT)).toBe('unknown')
  })
})

describe('getRegistrationErrorMessage', () => {
  it('names the linked account on a 409 caused by its identifier', () => {
    const error = httpError(409, 'parentLoginIdentifier already taken')
    const message = getRegistrationErrorMessage(error, NEW_LINKED_PARENT)
    expect(message).toContain('marie.dupont')
    expect(message).toMatch(/compte parent financeur lié est déjà utilisé/i)
  })

  it('names the main account on a 409 caused by the main identifier', () => {
    const error = httpError(409, "L'identifiant lucas.martin est déjà utilisé")
    const message = getRegistrationErrorMessage(error, NEW_LINKED_PARENT)
    expect(message).toContain('lucas.martin')
    expect(message).not.toMatch(/compte parent financeur lié/i)
  })

  it('asks the user to check both identifiers when the culprit cannot be determined', () => {
    const message = getRegistrationErrorMessage(httpError(409, 'Conflict'), NEW_LINKED_PARENT)
    expect(message).toMatch(/l'un des identifiants de connexion saisis/i)
  })

  it('explains a 404 as an unknown account to attach, in "existing" mode', () => {
    const message = getRegistrationErrorMessage(httpError(404), {
      relation: 'student',
      linkedAccountMode: 'existing',
      mainLoginIdentifier: 'marie.dupont',
      linkedLoginIdentifier: 'lucas.martin',
    })
    expect(message).toMatch(/aucun compte élève ne correspond/i)
    expect(message).toContain('lucas.martin')
  })

  it('explains a 400 as inconsistent linked fields when a linked account was requested', () => {
    const message = getRegistrationErrorMessage(
      httpError(400, ['parentEmail should not exist']),
      NEW_LINKED_PARENT,
    )
    expect(message).toMatch(/compte parent financeur lié sont incomplètes ou incohérentes/i)
  })

  it('falls back to the generic mapping for a 400 without any linked account', () => {
    const message = getRegistrationErrorMessage(
      httpError(400, 'Le mot de passe est trop court'),
      { relation: 'parent', linkedAccountMode: 'none', mainLoginIdentifier: 'lucas.martin' },
      'Erreur lors de la création du compte',
    )
    expect(message).toBe('Le mot de passe est trop court')
  })

  it('falls back to the caller message on an unmapped failure', () => {
    const message = getRegistrationErrorMessage(
      new Error('Network error'),
      { relation: 'parent', linkedAccountMode: 'none' },
      'Erreur lors de la création du compte',
    )
    expect(message).toBe('Erreur lors de la création du compte')
  })

  it('surfaces a 503 (profile-service unavailable) as a retryable server problem', () => {
    const message = getRegistrationErrorMessage(httpError(503), NEW_LINKED_PARENT)
    expect(message).toMatch(/serveur rencontre un problème/i)
  })
})
