/**
 * Tests for accountLinking utils
 *
 * Covers:
 * - buildLinkedAccountFields: locked identifier priority, existing/new modes, empty/none mode
 * - validateLinkedAccountData: locked identifier bypass, existing/new mode validation
 */

import { describe, it, expect } from 'vitest'
import {
  INITIAL_LINKED_ACCOUNT_DATA,
  buildLinkedAccountFields,
  validateLinkedAccountData,
  type LinkedAccountFormData,
} from '../../src/utils/accountLinking'

function withData(overrides: Partial<LinkedAccountFormData>): LinkedAccountFormData {
  return { ...INITIAL_LINKED_ACCOUNT_DATA, ...overrides }
}

describe('buildLinkedAccountFields', () => {
  it('returns no field when mode is "none"', () => {
    expect(buildLinkedAccountFields('parent', withData({ mode: 'none' }))).toEqual({})
    expect(buildLinkedAccountFields('student', withData({ mode: 'none' }))).toEqual({})
  })

  it('builds parentLoginIdentifier when mode is "existing"', () => {
    const data = withData({ mode: 'existing', loginIdentifier: '  marie.dupont  ' })
    expect(buildLinkedAccountFields('parent', data)).toEqual({
      parentLoginIdentifier: 'marie.dupont',
    })
  })

  it('builds studentLoginIdentifier when mode is "existing"', () => {
    const data = withData({ mode: 'existing', loginIdentifier: 'lucas.martin' })
    expect(buildLinkedAccountFields('student', data)).toEqual({
      studentLoginIdentifier: 'lucas.martin',
    })
  })

  it('builds parentEmail/parentFirstName/parentLastName/parentPassword when mode is "new"', () => {
    const data = withData({
      mode: 'new',
      email: 'marie@test.com',
      firstName: 'Marie',
      lastName: 'Dupont',
      password: 'secret123',
    })
    expect(buildLinkedAccountFields('parent', data)).toEqual({
      parentEmail: 'marie@test.com',
      parentFirstName: 'Marie',
      parentLastName: 'Dupont',
      parentPassword: 'secret123',
    })
  })

  it('omits password field (undefined) when left empty in "new" mode', () => {
    const data = withData({
      mode: 'new',
      email: 'marie@test.com',
      firstName: 'Marie',
      lastName: 'Dupont',
      password: '',
    })
    const result = buildLinkedAccountFields('parent', data)
    expect(result.parentPassword).toBeUndefined()
    expect(result.parentEmail).toBe('marie@test.com')
  })

  it('returns no field when mode is "new" but email is empty', () => {
    const data = withData({ mode: 'new', email: '', firstName: 'Marie', lastName: 'Dupont' })
    expect(buildLinkedAccountFields('parent', data)).toEqual({})
  })

  it('prioritizes lockedLoginIdentifier over mode/data', () => {
    const data = withData({ mode: 'new', email: 'marie@test.com', firstName: 'Marie', lastName: 'Dupont' })
    expect(buildLinkedAccountFields('parent', data, 'locked.identifier')).toEqual({
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

  it('returns an error when mode is "new" and required fields are missing', () => {
    const error = validateLinkedAccountData(
      'student',
      withData({ mode: 'new', email: '', firstName: 'Lucas', lastName: '' }),
    )
    expect(error).toMatch(/email, le prénom et le nom de l'élève/i)
  })

  it('returns null when mode is "new" and all required fields are filled (password optional)', () => {
    const error = validateLinkedAccountData(
      'student',
      withData({ mode: 'new', email: 'lucas@test.com', firstName: 'Lucas', lastName: 'Martin', password: '' }),
    )
    expect(error).toBeNull()
  })
})
