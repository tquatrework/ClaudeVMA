/**
 * `useProfileForm` — la réponse de chaque écriture entre dans l'état de l'écran,
 * **bloc par bloc**.
 *
 * Ces tests gardent le piège des formes de réponse, qu'un écran ne montre pas
 * toujours (`docs/routes.md` § profile-service) :
 *
 * - `GET /profiles/:userId` renvoie une **enveloppe** `{administrative,
 *   pedagogical, pedagogicalType, …}` ;
 * - les trois `PUT` renvoient un **bloc à plat** `{userId, ...champs}`.
 *
 * Fusionner naïvement écraserait l'enveloppe par un objet plat, et la fiche
 * perdrait ses autres blocs. La prescription est le cas révélateur : sa réponse
 * porte `filledBy` et `filledAt`, **posés côté serveur**, qui n'existent nulle
 * part dans le corps envoyé. Les voir apparaître sans rechargement prouve que
 * c'est bien la réponse du serveur qui est lue, et non le corps de la requête.
 */

import { renderHook, act, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../src/api/profile')

import { useProfileForm } from '../../src/hooks/profile/useProfileForm'
import {
  fetchProfile,
  updateAdministrativeProfile,
  updatePedagogicalProfile,
  updatePrescription,
} from '../../src/api/profile'

const mockFetchProfile = vi.mocked(fetchProfile)
const mockUpdateAdministrativeProfile = vi.mocked(updateAdministrativeProfile)
const mockUpdatePedagogicalProfile = vi.mocked(updatePedagogicalProfile)
const mockUpdatePrescription = vi.mocked(updatePrescription)

const USER_ID = 'student-9'

const LOADED_PROFILE = {
  userId: USER_ID,
  pedagogicalType: 'student' as const,
  administrative: { firstName: 'Marie', lastName: 'Dupont', avatarUrl: '/photo?v=1' },
  pedagogical: { level: 'Première', subjects: ['Mathématiques'] },
}

async function renderLoadedForm() {
  const rendered = renderHook(() => useProfileForm(USER_ID))
  await waitFor(() => {
    expect(rendered.result.current.administrative).toBeDefined()
  })
  return rendered
}

beforeEach(() => {
  vi.clearAllMocks()
  mockFetchProfile.mockResolvedValue(LOADED_PROFILE)
})

describe('useProfileForm — propagation des réponses d’écriture', () => {
  it('fait apparaître filledBy et filledAt après une prescription, sans relire le profil', async () => {
    mockUpdatePrescription.mockResolvedValue({
      userId: USER_ID,
      level: 'Première',
      subjects: ['Mathématiques'],
      generalAssessment: 'Bases solides.',
      filledBy: 'rp-1',
      filledAt: '2026-08-10T10:15:00.000Z',
    })

    const { result } = await renderLoadedForm()

    await act(async () => {
      // Le corps envoyé ne contient ni `filledBy` ni `filledAt` : les y mettre
      // vaudrait `400`. Ils ne peuvent donc venir que de la réponse.
      await result.current.savePrescription({ generalAssessment: 'bases solides' })
    })

    expect(result.current.pedagogical?.filledBy).toBe('rp-1')
    expect(result.current.pedagogical?.filledAt).toBe('2026-08-10T10:15:00.000Z')
    expect(result.current.pedagogical?.generalAssessment).toBe('Bases solides.')
    expect(mockFetchProfile).toHaveBeenCalledTimes(1)
  })

  it('n’écrase pas l’enveloppe avec un bloc à plat', async () => {
    mockUpdatePedagogicalProfile.mockResolvedValue({
      userId: USER_ID,
      level: 'Terminale générale',
    })

    const { result } = await renderLoadedForm()

    await act(async () => {
      await result.current.savePedagogical({ level: 'terminale' })
    })

    // Le bloc pédagogique a suivi…
    expect(result.current.pedagogical?.level).toBe('Terminale générale')
    // …sans emporter le reste de la fiche : l'administratif et la forme du
    // profil sont portés par l'enveloppe, que la réponse plate ne contient pas.
    expect(result.current.administrative?.firstName).toBe('Marie')
    expect(result.current.pedagogicalType).toBe('student')
    // La section déclarative renvoyée est fusionnée, pas substituée.
    expect(result.current.pedagogical?.subjects).toEqual(['Mathématiques'])
  })

  it('garde le bloc pédagogique intact quand seul l’administratif est enregistré', async () => {
    mockUpdateAdministrativeProfile.mockResolvedValue({
      userId: USER_ID,
      firstName: 'Marion',
      lastName: 'DUPONT',
      updatedAt: '2026-08-10T09:30:00.000Z',
    })

    const { result } = await renderLoadedForm()

    await act(async () => {
      await result.current.saveAdministrative({ firstName: 'marion' })
    })

    expect(result.current.administrative?.firstName).toBe('Marion')
    expect(result.current.administrative?.lastName).toBe('DUPONT')
    expect(result.current.pedagogical?.level).toBe('Première')
    // La photo n'est pas un champ éditable du formulaire : elle a ses propres
    // routes, et l'envoyer au `PUT` vaudrait `400`.
    expect(result.current.administrative).not.toHaveProperty('avatarUrl')
    expect(result.current.avatarUrl).toBe('/photo?v=1')
  })

  it('laisse l’écran inchangé quand l’écriture échoue', async () => {
    mockUpdateAdministrativeProfile.mockRejectedValue({ response: { status: 403, data: {} } })

    const { result } = await renderLoadedForm()

    await act(async () => {
      await result.current.saveAdministrative({ firstName: 'marion' })
    })

    expect(result.current.administrative?.firstName).toBe('Marie')
    expect(result.current.administrativeSaveError).toBeTruthy()
  })
})
