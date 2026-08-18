import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import AvailabilityGrid from '../../../src/components/calendar/AvailabilityGrid'
import type { AvailabilitySlot } from '../../../src/types/calendar'

const AVAILABLE_SLOT: AvailabilitySlot = {
  id: 'slot-1',
  ownerId: 'owner-1',
  dayOfWeek: 1, // lundi
  startTime: '09:00',
  endTime: '10:00',
  recurrence: 'WEEKLY',
  recurrenceEndDate: null,
  kind: 'AVAILABLE',
}

const UNAVAILABLE_SLOT: AvailabilitySlot = {
  id: 'slot-2',
  ownerId: 'owner-1',
  dayOfWeek: 3, // mercredi
  startTime: '14:00',
  endTime: '16:00',
  recurrence: 'NONE',
  recurrenceEndDate: null,
  kind: 'UNAVAILABLE',
}

describe('AvailabilityGrid — rendu', () => {
  it('affiche les jours de la semaine, lundi en premier', () => {
    render(<AvailabilityGrid slots={[]} onCreateAt={vi.fn()} onEditSlot={vi.fn()} />)

    const headers = screen.getAllByText(/^(Lundi|Mardi|Mercredi|Jeudi|Vendredi|Samedi|Dimanche)$/)
    expect(headers[0]).toHaveTextContent('Lundi')
    expect(headers[6]).toHaveTextContent('Dimanche')
  })

  it('affiche les créneaux existants comme des blocs', () => {
    render(
      <AvailabilityGrid
        slots={[AVAILABLE_SLOT, UNAVAILABLE_SLOT]}
        onCreateAt={vi.fn()}
        onEditSlot={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('button', {
        name: /modifier le créneau lundi 09:00 – 10:00 — disponible/i,
      }),
    ).toBeDefined()
    expect(
      screen.getByRole('button', {
        name: /modifier le créneau mercredi 14:00 – 16:00 — indisponible/i,
      }),
    ).toBeDefined()
  })
})

describe('AvailabilityGrid — interaction', () => {
  it('ouvre la création au clic sur une cellule horaire vide', async () => {
    const onCreateAt = vi.fn()
    render(<AvailabilityGrid slots={[]} onCreateAt={onCreateAt} onEditSlot={vi.fn()} />)

    await userEvent.click(
      screen.getByRole('button', { name: 'Ajouter un créneau lundi à 09:00' }),
    )

    expect(onCreateAt).toHaveBeenCalledWith(1, '09:00')
  })

  it('ouvre l\'édition au clic sur un bloc existant', async () => {
    const onEditSlot = vi.fn()
    render(
      <AvailabilityGrid slots={[AVAILABLE_SLOT]} onCreateAt={vi.fn()} onEditSlot={onEditSlot} />,
    )

    await userEvent.click(
      screen.getByRole('button', {
        name: /modifier le créneau lundi 09:00 – 10:00 — disponible/i,
      }),
    )

    expect(onEditSlot).toHaveBeenCalledWith(AVAILABLE_SLOT)
  })

  it('désactive les cellules de création en lecture seule', () => {
    render(
      <AvailabilityGrid slots={[]} onCreateAt={vi.fn()} onEditSlot={vi.fn()} readOnly />,
    )

    const cell = screen.getByRole('button', { name: 'Ajouter un créneau lundi à 09:00' })
    expect(cell).toBeDisabled()
  })

  it("désactive aussi les blocs existants en lecture seule — aucune interaction d'édition possible", async () => {
    const onEditSlot = vi.fn()
    render(
      <AvailabilityGrid
        slots={[AVAILABLE_SLOT]}
        onCreateAt={vi.fn()}
        onEditSlot={onEditSlot}
        readOnly
      />,
    )

    const block = screen.getByRole('button', {
      name: /consulter le créneau lundi 09:00 – 10:00 — disponible/i,
    })
    expect(block).toBeDisabled()

    await userEvent.click(block).catch(() => {
      // userEvent refuse de cliquer un bouton désactivé — c'est précisément ce qui est vérifié.
    })
    expect(onEditSlot).not.toHaveBeenCalled()
  })
})
