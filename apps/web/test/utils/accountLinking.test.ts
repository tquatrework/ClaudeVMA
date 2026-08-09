/**
 * Tests for accountLinking utils
 *
 * Covers:
 * - buildLinkedAccountFields: locked identifier priority, existing/new modes, empty/none mode,
 *   and transmission of the declared intent (`parentAccountMode`/`studentAccountMode`)
 * - validateLinkedAccountData: locked identifier bypass, existing/new mode validation,
 *   login identifier required and long enough in "new" mode, collision with the main account
 */

import { describe, it, expect } from 'vitest'
import {
  INITIAL_LINKED_ACCOUNT_DATA,
  MIN_LOGIN_IDENTIFIER_LENGTH,
  buildLinkedAccountFields,
  validateLinkedAccountData,
  type LinkedAccountFormData,
} from '../../src/utils/accountLinking'

function withData(overrides: Partial<LinkedAccountFormData>): LinkedAccountFormData {
  return { ...INITIAL_LINKED_ACCOUNT_DATA, ...overrides }
}

describe('buildLinkedAccountFields', () => {
  it('returns no field at all when mode is "none" (a simple registration stays unchanged)', () => {
    expect(buildLinkedAccountFields('parent', withData({ mode: 'none' }))).toEqual({})
    expect(buildLinkedAccountFields('student', withData({ mode: 'none' }))).toEqual({})
  })

  it('builds parentAccountMode + parentLoginIdentifier when mode is "existing"', () => {
    const data = withData({ mode: 'existing', loginIdentifier: '  marie.dupont  ' })
    expect(buildLinkedAccountFields('parent', data)).toEqual({
      parentAccountMode: 'existing',
      parentLoginIdentifier: 'marie.dupont',
    })
  })

  it('builds studentAccountMode + studentLoginIdentifier when mode is "existing"', () => {
    const data = withData({ mode: 'existing', loginIdentifier: 'lucas.martin' })
    expect(buildLinkedAccountFields('student', data)).toEqual({
      studentAccountMode: 'existing',
      studentLoginIdentifier: 'lucas.martin',
    })
  })

  it('builds the chosen login identifier alongside the identity fields when mode is "new"', () => {
    const data = withData({
      mode: 'new',
      loginIdentifier: '  marie.dupont  ',
      email: 'marie@test.com',
      firstName: 'Marie',
      lastName: 'Dupont',
      password: 'secret123',
    })
    expect(buildLinkedAccountFields('parent', data)).toEqual({
      parentAccountMode: 'new',
      parentLoginIdentifier: 'marie.dupont',
      parentEmail: 'marie@test.com',
      parentFirstName: 'Marie',
      parentLastName: 'Dupont',
      parentPassword: 'secret123',
    })
  })

  it('builds the symmetric student fields when mode is "new"', () => {
    const data = withData({
      mode: 'new',
      loginIdentifier: 'lucas.martin',
      email: 'lucas@test.com',
      firstName: 'Lucas',
      lastName: 'Martin',
      password: '',
    })
    expect(buildLinkedAccountFields('student', data)).toEqual({
      studentAccountMode: 'new',
      studentLoginIdentifier: 'lucas.martin',
      studentEmail: 'lucas@test.com',
      studentFirstName: 'Lucas',
      studentLastName: 'Martin',
      studentPassword: undefined,
    })
  })

  it('omits password field (undefined) when left empty in "new" mode', () => {
    const data = withData({
      mode: 'new',
      loginIdentifier: 'marie.dupont',
      email: 'marie@test.com',
      firstName: 'Marie',
      lastName: 'Dupont',
      password: '',
    })
    const result = buildLinkedAccountFields('parent', data)
    expect(result.parentPassword).toBeUndefined()
    expect(result.parentEmail).toBe('marie@test.com')
  })

  it('omits the login identifier rather than sending an empty string in "new" mode', () => {
    const data = withData({
      mode: 'new',
      loginIdentifier: '   ',
      email: 'marie@test.com',
      firstName: 'Marie',
      lastName: 'Dupont',
    })
    expect(buildLinkedAccountFields('parent', data).parentLoginIdentifier).toBeUndefined()
  })

  it('returns no field when mode is "new" but email is empty', () => {
    const data = withData({ mode: 'new', email: '', firstName: 'Marie', lastName: 'Dupont' })
    expect(buildLinkedAccountFields('parent', data)).toEqual({})
  })

  it('treats lockedLoginIdentifier as the "existing" mode, over mode/data', () => {
    const data = withData({ mode: 'new', email: 'marie@test.com', firstName: 'Marie', lastName: 'Dupont' })
    expect(buildLinkedAccountFields('parent', data, 'locked.identifier')).toEqual({
      parentAccountMode: 'existing',
      parentLoginIdentifier: 'locked.identifier',
    })
  })
})

describe('validateLinkedAccountData', () => {
  it('returns null when lockedLoginIdentifier is set, regardless of mode/data', () => {
    expect(
      validateLinkedAccountData('parent', withData({ mode: 'existing', loginIdentifier: '' }), 'locked'),
    ).toBeNull()
  })

  it('returns null when mode is "none"', () => {
    expect(validateLinkedAccountData('parent', withData({ mode: 'none' }))).toBeNull()
  })

  it('returns an error when mode is "existing" and loginIdentifier is empty', () => {
    const error = validateLinkedAccountData('parent', withData({ mode: 'existing', loginIdentifier: '  ' }))
    expect(error).toMatch(/identifiant du parent financeur à lier/i)
  })

  it('returns an error when mode is "existing" and loginIdentifier is too short', () => {
    const error = validateLinkedAccountData('parent', withData({ mode: 'existing', loginIdentifier: 'ab' }))
    expect(error).toMatch(new RegExp(`au moins ${MIN_LOGIN_IDENTIFIER_LENGTH} caractères`, 'i'))
  })

  it('returns an error when mode is "new" and required identity fields are missing', () => {
    const error = validateLinkedAccountData(
      'student',
      withData({ mode: 'new', email: '', firstName: 'Lucas', lastName: '' }),
    )
    expect(error).toMatch(/email, le prénom et le nom de l'élève/i)
  })

  it('returns an error when mode is "new" and the login identifier is missing', () => {
    const error = validateLinkedAccountData(
      'student',
      withData({
        mode: 'new',
        loginIdentifier: '',
        email: 'lucas@test.com',
        firstName: 'Lucas',
        lastName: 'Martin',
      }),
    )
    expect(error).toMatch(/identifiant de connexion de l'élève est requis/i)
  })

  it('returns an error when mode is "new" and the login identifier is too short', () => {
    const error = validateLinkedAccountData(
      'student',
      withData({
        mode: 'new',
        loginIdentifier: 'ab',
        email: 'lucas@test.com',
        firstName: 'Lucas',
        lastName: 'Martin',
      }),
    )
    expect(error).toMatch(new RegExp(`au moins ${MIN_LOGIN_IDENTIFIER_LENGTH} caractères`, 'i'))
  })

  it('rejects a linked login identifier identical to the main account one (case-insensitive)', () => {
    const error = validateLinkedAccountData(
      'parent',
      withData({
        mode: 'new',
        loginIdentifier: 'Marie.Dupont',
        email: 'marie@test.com',
        firstName: 'Marie',
        lastName: 'Dupont',
      }),
      null,
      'marie.dupont',
    )
    expect(error).toMatch(/différent du vôtre/i)
  })

  it('accepts a linked login identifier different from the main account one', () => {
    const error = validateLinkedAccountData(
      'parent',
      withData({
        mode: 'new',
        loginIdentifier: 'marie.dupont',
        email: 'marie@test.com',
        firstName: 'Marie',
        lastName: 'Dupont',
      }),
      null,
      'alice.dupont',
    )
    expect(error).toBeNull()
  })

  it('returns null when mode is "new" and all required fields are filled (password optional)', () => {
    const error = validateLinkedAccountData(
      'student',
      withData({
        mode: 'new',
        loginIdentifier: 'lucas.martin',
        email: 'lucas@test.com',
        firstName: 'Lucas',
        lastName: 'Martin',
        password: '',
      }),
    )
    expect(error).toBeNull()
  })
})
