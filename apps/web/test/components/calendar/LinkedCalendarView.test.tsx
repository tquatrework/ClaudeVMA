/**
 * LinkedCalendarView — calendrier busy/free d'un tiers lié, strictement en lecture seule.
 * Vérifie le rendu des trois catégories et l'absence de toute interaction d'édition (aucun
 * clic sur un bloc ni sur une cellule vide ne doit rien déclencher), ainsi que les états
 * chargement/erreur du hook sous-jacent.
 */

import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LinkedCalendarView from '../../../src/components/calendar/LinkedCalendarView'

vi.mock('../../../src/api/calendar')

import { fetchLinkedCalendarBusyFree } from '../../../src/api/calendar'

const mockFetchLinkedCalendarBusyFree = vi.mocked(fetchLinkedCalendarBusyFree)

const OWNER_ID = 'owner-1'
const FROM = '2026-09-10T00:00:00Z'
const TO = '2026-09-17T00:00:00Z'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('LinkedCalendarView — succès', () => {
  it('affiche les trois catégories, sans jamais afficher de contenu pour les blocs occupés', async () => {
    mockFetchLinkedCalendarBusyFree.mockResolvedValue({
      ownerId: OWNER_ID,
      from: '2026-09-10T00:00:00.000Z',
      to: '2026-09-17T00:00:00.000Z',
      // 2026-09-10 est un jeudi.
      availableWindows: [{ start: '2026-09-10T09:00:00.000Z', end: '2026-09-10T11:00:00.000Z' }],
      unavailableBlocks: [{ start: '2026-09-11T09:00:00.000Z', end: '2026-09-11T10:00:00.000Z' }],
      busyBlocks: [{ start: '2026-09-13T09:00:00.000Z', end: '2026-09-13T10:00:00.000Z' }],
    })

    render(<LinkedCalendarView ownerId={OWNER_ID} from={FROM} to={TO} />)

    expect(
      await screen.findByRole('button', {
        name: /consulter le créneau jeudi 09:00 – 11:00 — disponible/i,
      }),
    ).toBeDefined()
    expect(
      screen.getByRole('button', {
        name: /consulter le créneau vendredi 09:00 – 10:00 — indisponible/i,
      }),
    ).toBeDefined()
    const busyBlock = screen.getByRole('button', {
      name: /consulter le créneau dimanche 09:00 – 10:00 — occupé/i,
    })
    expect(busyBlock).toBeDefined()
    // Aucun contenu d'activité (titre, type) — seule la mention "Occupé".
    expect(busyBlock.textContent).not.toMatch(/cours|masterclass|pédagogique/i)
  })

  it("n'ouvre aucune interaction — ni sur un bloc existant, ni sur une cellule vide", async () => {
    mockFetchLinkedCalendarBusyFree.mockResolvedValue({
      ownerId: OWNER_ID,
      from: '2026-09-10T00:00:00.000Z',
      to: '2026-09-17T00:00:00.000Z',
      availableWindows: [{ start: '2026-09-10T09:00:00.000Z', end: '2026-09-10T11:00:00.000Z' }],
      unavailableBlocks: [],
      busyBlocks: [],
    })

    render(<LinkedCalendarView ownerId={OWNER_ID} from={FROM} to={TO} />)

    const block = await screen.findByRole('button', {
      name: /consulter le créneau jeudi 09:00 – 11:00 — disponible/i,
    })
    expect(block).toBeDisabled()

    const emptyCell = screen.getByRole('button', { name: 'Ajouter un créneau lundi à 09:00' })
    expect(emptyCell).toBeDisabled()

    await userEvent.click(block).catch(() => {})
    await userEvent.click(emptyCell).catch(() => {})
    // Aucune assertion d'appel à faire : la grille est composée avec des callbacks internes
    // no-op — le test de comportement porte sur l'état `disabled`, vérifié ci-dessus.
  })

  it('affiche un état vide si aucun créneau ne couvre la période', async () => {
    mockFetchLinkedCalendarBusyFree.mockResolvedValue({
      ownerId: OWNER_ID,
      from: '2026-09-10T00:00:00.000Z',
      to: '2026-09-17T00:00:00.000Z',
      availableWindows: [],
      unavailableBlocks: [],
      busyBlocks: [],
    })

    render(<LinkedCalendarView ownerId={OWNER_ID} from={FROM} to={TO} />)

    expect(await screen.findByText('Aucun créneau sur cette période')).toBeDefined()
  })
})

describe('LinkedCalendarView — chargement et erreurs', () => {
  it('affiche un état de chargement avant résolution', () => {
    mockFetchLinkedCalendarBusyFree.mockReturnValue(new Promise(() => {}))

    render(<LinkedCalendarView ownerId={OWNER_ID} from={FROM} to={TO} />)

    expect(screen.getByText(/chargement du calendrier/i)).toBeDefined()
  })

  it('403 — affiche un message générique, jamais un UUID ni un détail technique', async () => {
    mockFetchLinkedCalendarBusyFree.mockRejectedValue({
      response: { status: 403, data: { message: `No relation opens calendar ${OWNER_ID}` } },
    })

    render(<LinkedCalendarView ownerId={OWNER_ID} from={FROM} to={TO} />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/pas accès au calendrier/i)
    expect(alert.textContent).not.toMatch(new RegExp(OWNER_ID))
  })

  it('503 — affiche un message de service indisponible', async () => {
    mockFetchLinkedCalendarBusyFree.mockRejectedValue({ response: { status: 503 } })

    render(<LinkedCalendarView ownerId={OWNER_ID} from={FROM} to={TO} />)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/temporairement indisponible/i)
  })
})
