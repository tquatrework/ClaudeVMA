import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import QuickEventCreatePopover from '../../../src/components/calendar/QuickEventCreatePopover'

vi.mock('../../../src/api/calendar')

// `dayOfWeek: 1` (lundi) — même convention que `Date.getUTCDay()`. Référence choisie le
// 2026-08-24, un lundi réel (vérifié : `new Date('2026-08-24T16:00:00.000Z').getUTCDay() === 1`).
const MONDAY = 1
const REFERENCE_NOW = '2026-08-24T16:00:00.000Z' // lundi 16h00 UTC

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(REFERENCE_NOW))
})

afterEach(() => {
  vi.useRealTimers()
})

describe('QuickEventCreatePopover — avertissement de date déjà passée (2026-08-19)', () => {
  it("affiche un avertissement quand le jour/heure cliqués résolvent vers aujourd'hui, déjà passé", () => {
    render(
      <QuickEventCreatePopover
        ownerId="owner-1"
        userRole="formateur"
        dayOfWeek={MONDAY}
        startTime="09:00" // aujourd'hui (lundi) à 09:00, alors qu'il est déjà 16h — dans le passé
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText(/cette date est déjà passée/i)).toBeDefined()
    // L'avertissement n'empêche jamais de valider : le bouton reste actif.
    expect(screen.getByRole('button', { name: /^créer$/i })).not.toBeDisabled()
  })

  it("n'affiche aucun avertissement quand le jour/heure cliqués résolvent vers une date future", () => {
    render(
      <QuickEventCreatePopover
        ownerId="owner-1"
        userRole="formateur"
        dayOfWeek={MONDAY}
        startTime="18:00" // aujourd'hui (lundi) à 18h — après l'heure de référence (16h)
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByText(/cette date est déjà passée/i)).toBeNull()
  })

  it("n'affiche aucun avertissement quand le jour cliqué n'est pas encore survenu cette semaine", () => {
    render(
      <QuickEventCreatePopover
        ownerId="owner-1"
        userRole="formateur"
        dayOfWeek={3} // mercredi, après le lundi de référence
        startTime="09:00"
        onCreated={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByText(/cette date est déjà passée/i)).toBeNull()
  })
})
