import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import AvailabilitySlotFormModal from '../../../src/components/calendar/AvailabilitySlotFormModal'
import type { AvailabilitySlot } from '../../../src/types/calendar'

const CREATE_INITIAL_VALUES = {
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '10:00',
  kind: 'AVAILABLE' as const,
  recurrence: 'NONE' as const,
  recurrenceEndDate: null,
}

const EXISTING_SLOT: AvailabilitySlot = {
  id: 'slot-1',
  ownerId: 'owner-1',
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '10:00',
  recurrence: 'WEEKLY',
  recurrenceEndDate: null,
  kind: 'AVAILABLE',
}

describe('AvailabilitySlotFormModal — création', () => {
  it('soumet le payload construit à partir du formulaire', async () => {
    const onSubmit = vi.fn()
    render(
      <AvailabilitySlotFormModal
        initialValues={CREATE_INITIAL_VALUES}
        isSaving={false}
        errorMessage={null}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: /nouveau créneau/i })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /^créer$/i }))

    expect(onSubmit).toHaveBeenCalledWith({
      dayOfWeek: 1,
      startTime: '09:00',
      endTime: '10:00',
      kind: 'AVAILABLE',
      recurrence: 'NONE',
      recurrenceEndDate: null,
    })
  })

  it('refuse la soumission si la fin précède le début', async () => {
    const onSubmit = vi.fn()
    render(
      <AvailabilitySlotFormModal
        initialValues={{ ...CREATE_INITIAL_VALUES, startTime: '10:00', endTime: '09:00' }}
        isSaving={false}
        errorMessage={null}
        onSubmit={onSubmit}
        onClose={vi.fn()}
      />,
    )

    const submitButton = screen.getByRole('button', { name: /^créer$/i })
    expect(submitButton).toBeDisabled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('affiche le champ de date de fin uniquement pour une récurrence non nulle', async () => {
    render(
      <AvailabilitySlotFormModal
        initialValues={CREATE_INITIAL_VALUES}
        isSaving={false}
        errorMessage={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByLabelText(/date de fin de récurrence/i)).toBeNull()

    await userEvent.selectOptions(screen.getByLabelText(/récurrence/i), 'WEEKLY')

    expect(screen.getByLabelText(/date de fin de récurrence/i)).toBeDefined()
  })
})

describe('AvailabilitySlotFormModal — édition', () => {
  it('propose un bouton supprimer en mode édition', async () => {
    const onDelete = vi.fn()
    render(
      <AvailabilitySlotFormModal
        editingSlot={EXISTING_SLOT}
        initialValues={CREATE_INITIAL_VALUES}
        isSaving={false}
        errorMessage={null}
        onSubmit={vi.fn()}
        onDelete={onDelete}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('dialog', { name: /modifier le créneau/i })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: /supprimer/i }))

    expect(onDelete).toHaveBeenCalled()
  })
})

describe('AvailabilitySlotFormModal — avertissement de date déjà passée (2026-08-19)', () => {
  // `dayOfWeek: 1` (lundi), référence 2026-08-24 16h00 UTC — même convention et même date de
  // référence que `QuickEventCreatePopover.test.tsx`, pour la même cohérence de flow.
  const REFERENCE_NOW = '2026-08-24T16:00:00.000Z'

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(REFERENCE_NOW))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("avertit en récurrence « Une seule fois » quand l'heure du jour cliqué est déjà passée aujourd'hui", () => {
    render(
      <AvailabilitySlotFormModal
        initialValues={{ ...CREATE_INITIAL_VALUES, startTime: '09:00', endTime: '10:00' }}
        isSaving={false}
        errorMessage={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText(/est déjà passée/i)).toBeDefined()
  })

  it("n'avertit pas quand l'heure résolue est encore à venir aujourd'hui", () => {
    render(
      <AvailabilitySlotFormModal
        initialValues={{ ...CREATE_INITIAL_VALUES, startTime: '18:00', endTime: '19:00' }}
        isSaving={false}
        errorMessage={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByText(/est déjà passée/i)).toBeNull()
  })

  it("n'avertit jamais pour une récurrence hebdomadaire, même si l'heure du jour est déjà passée aujourd'hui", () => {
    // Pas d'interaction `userEvent` ici : ses délais internes (`setTimeout`) sont incompatibles
    // avec `vi.useFakeTimers()` sans avancer les timers — la récurrence WEEKLY est donc passée
    // directement en valeur initiale plutôt que sélectionnée via le menu déroulant.
    render(
      <AvailabilitySlotFormModal
        initialValues={{
          ...CREATE_INITIAL_VALUES,
          startTime: '09:00',
          endTime: '10:00',
          recurrence: 'WEEKLY',
        }}
        isSaving={false}
        errorMessage={null}
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.queryByText(/est déjà passée/i)).toBeNull()
  })
})

describe('AvailabilitySlotFormModal — erreur', () => {
  it("affiche le message d'erreur transmis", () => {
    render(
      <AvailabilitySlotFormModal
        initialValues={CREATE_INITIAL_VALUES}
        isSaving={false}
        errorMessage="Le créneau n'a pas pu être créé."
        onSubmit={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText("Le créneau n'a pas pu être créé.")).toBeDefined()
  })
})
