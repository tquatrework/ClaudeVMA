/**
 * Tests for LinkedAccountSection
 *
 * Covers:
 * - Locked mode (URL param present): read-only mention, no mode choice.
 * - Free mode: mode selection (none/existing/new) and conditional fields.
 * - onChange callbacks propagate field updates.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { LinkedAccountSection } from '../../../src/components/accounts/LinkedAccountSection'
import { INITIAL_LINKED_ACCOUNT_DATA } from '../../../src/utils/accountLinking'

describe('LinkedAccountSection — locked mode', () => {
  it('shows a read-only mention and no mode choice when lockedLoginIdentifier is set', () => {
    render(
      <LinkedAccountSection
        relation="parent"
        data={INITIAL_LINKED_ACCOUNT_DATA}
        onChange={vi.fn()}
        lockedLoginIdentifier="marie.dupont"
      />,
    )

    expect(screen.getByText(/lié automatiquement/i)).toBeDefined()
    expect(screen.getByText('marie.dupont')).toBeDefined()
    expect(screen.queryByText(/ne rien lier maintenant/i)).toBeNull()
  })
})

describe('LinkedAccountSection — free mode (relation="parent")', () => {
  it('defaults to "none" and hides existing/new fields', () => {
    render(
      <LinkedAccountSection relation="parent" data={INITIAL_LINKED_ACCOUNT_DATA} onChange={vi.fn()} />,
    )

    expect(screen.queryByLabelText(/identifiant parent financeur/i)).toBeNull()
    expect(screen.queryByLabelText(/prénom parent financeur/i)).toBeNull()
  })

  it('shows the existing-identifier field when "existing" is selected', async () => {
    const handleChange = vi.fn()
    render(
      <LinkedAccountSection relation="parent" data={INITIAL_LINKED_ACCOUNT_DATA} onChange={handleChange} />,
    )

    await userEvent.click(screen.getByRole('radio', { name: /lier un compte parent financeur existant/i }))

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'existing' }),
    )
  })

  it('shows the new-account fields when "new" is selected', async () => {
    const handleChange = vi.fn()
    render(
      <LinkedAccountSection relation="parent" data={INITIAL_LINKED_ACCOUNT_DATA} onChange={handleChange} />,
    )

    await userEvent.click(
      screen.getByRole('radio', { name: /créer un nouveau compte parent financeur lié/i }),
    )

    expect(handleChange).toHaveBeenCalledWith(expect.objectContaining({ mode: 'new' }))
  })

  it('renders new-account input fields and propagates changes', async () => {
    const handleChange = vi.fn()
    render(
      <LinkedAccountSection
        relation="parent"
        data={{ ...INITIAL_LINKED_ACCOUNT_DATA, mode: 'new' }}
        onChange={handleChange}
      />,
    )

    const emailInput = screen.getByLabelText(/email parent financeur/i)
    await userEvent.type(emailInput, 'm')

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'new', email: 'm' }),
    )
  })

  it('renders the existing-identifier input and propagates changes', async () => {
    const handleChange = vi.fn()
    render(
      <LinkedAccountSection
        relation="parent"
        data={{ ...INITIAL_LINKED_ACCOUNT_DATA, mode: 'existing' }}
        onChange={handleChange}
      />,
    )

    const identifierInput = screen.getByLabelText(/identifiant parent financeur/i)
    await userEvent.type(identifierInput, 'm')

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'existing', loginIdentifier: 'm' }),
    )
  })
})

describe('LinkedAccountSection — free mode (relation="student")', () => {
  it('uses "élève" wording in labels', () => {
    render(
      <LinkedAccountSection relation="student" data={INITIAL_LINKED_ACCOUNT_DATA} onChange={vi.fn()} />,
    )

    expect(screen.getByText(/lier un compte élève \(optionnel\)/i)).toBeDefined()
  })
})
