/**
 * Tests de TeacherValidationQueuePage — `/rp/teacher-validations`.
 *
 * La file que le RP n'avait pas : jusqu'ici la validation n'était atteignable
 * que depuis la fiche d'un formateur, donc seulement pour quelqu'un qu'il
 * connaissait déjà.
 *
 * Couvre : chargement, erreur, file peuplée, file vide, `levels`/`subjects` à
 * `null`, `403`, pagination, absence d'UUID à l'écran, décision remontée sans
 * rechargement, et le fait que l'action interdite au RP (`pending` →
 * `validated`) **n'est pas proposée**.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherValidationQueuePage from '../../src/pages/TeacherValidationQueuePage'
import { expectNoTechnicalIdentifier, makeUseAuthReturn } from '../../src/test-helpers'
import type { PendingTeacher } from '../../src/types/profile'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchPendingTeachers, updateTeacherValidationStatus } from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchPendingTeachers = vi.mocked(fetchPendingTeachers)
const mockUpdateTeacherValidationStatus = vi.mocked(updateTeacherValidationStatus)

const NADIA: PendingTeacher = {
  userId: '38132407-b428-4b11-a07c-4a719fcaa3c0',
  firstName: 'Nadia',
  lastName: 'Lambert',
  levels: ['collège'],
  subjects: ['mathématiques'],
  pendingSince: '2026-08-12T15:20:17.694Z',
}

const SANS_EXPERTISE: PendingTeacher = {
  userId: 'c5027520-841b-41a7-8140-eaf8dfc2ae50',
  firstName: 'Yanis',
  lastName: 'Roux',
  levels: null,
  subjects: null,
  pendingSince: '2026-08-12T15:20:17.703Z',
}

const SANS_NOM: PendingTeacher = {
  userId: 'ab8408f8-bd68-468b-8c83-5da5a06101ac',
  firstName: null,
  lastName: null,
  levels: [],
  subjects: [],
  pendingSince: '2026-08-12T15:20:17.708Z',
}

function buildPage(data: PendingTeacher[], overrides: Partial<Record<string, number>> = {}) {
  return {
    data,
    page: 1,
    limit: 20,
    total: data.length,
    totalPages: 1,
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <TeacherValidationQueuePage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'rp-1', role: 'responsable_pedagogique' }))
})

describe('TeacherValidationQueuePage', () => {
  it('affiche un état de chargement pendant la lecture de la file', () => {
    mockFetchPendingTeachers.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('affiche les formateurs en attente avec leur nom et leur expertise', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([NADIA, SANS_EXPERTISE]))

    renderPage()

    await screen.findByText('Nadia Lambert')
    expect(screen.getByText('Yanis Roux')).toBeDefined()
    expect(screen.getByText(/Niveaux : collège/)).toBeDefined()
    expect(screen.getByText(/Matières : mathématiques/)).toBeDefined()
  })

  it('annonce le nombre de dossiers en attente', async () => {
    mockFetchPendingTeachers.mockResolvedValue(
      buildPage([NADIA, SANS_EXPERTISE], { total: 17, totalPages: 1 }),
    )

    renderPage()

    await screen.findByText('17 dossiers en attente')
  })

  it("n'affiche jamais « null » pour des niveaux ou matières non renseignés", async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([SANS_EXPERTISE]))

    const { container } = renderPage()

    await screen.findByText('Yanis Roux')
    expect(screen.getByText('Niveaux et matières non renseignés')).toBeDefined()
    expect(container.textContent).not.toContain('null')
  })

  it('traite une liste vide enregistrée comme un non-renseigné à l’écran', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([SANS_NOM]))

    const { container } = renderPage()

    await screen.findByText('Niveaux et matières non renseignés')
    expect(container.textContent).not.toContain('null')
    expect(container.textContent).not.toContain('[]')
  })

  it("n'affiche aucun identifiant technique, même sans prénom ni nom", async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([SANS_NOM]))

    const { container } = renderPage()

    await screen.findByText('Formateur (nom non renseigné)')
    expectNoTechnicalIdentifier(container)
  })

  it('affiche un état vide explicite quand personne n’attend', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([], { totalPages: 0 }))

    renderPage()

    await screen.findByText("Aucun formateur en attente d'examen.")
  })

  it('affiche le message du serveur quand la file est refusée en 403', async () => {
    mockFetchPendingTeachers.mockRejectedValue({
      response: { status: 403, data: { message: 'Rôle insuffisant.' } },
    })

    renderPage()

    await screen.findByText('Rôle insuffisant.')
  })

  it("n'offre pas au RP la validation directe depuis « en attente »", async () => {
    // `pending` → `validated` est réservé au TI : le serveur répond 403 avec un
    // message français. Une entrée qui mènerait à un refus ne s'affiche pas.
    mockFetchPendingTeachers.mockResolvedValue(buildPage([NADIA]))

    renderPage()

    await screen.findByText('Nadia Lambert')
    expect(screen.getByRole('button', { name: /prendre en charge/i })).toBeDefined()
    expect(screen.queryByRole('button', { name: /^valider$/i })).toBeNull()
    expect(screen.queryByRole('button', { name: /^refuser$/i })).toBeNull()
  })

  it('envoie {status: in_review} à la prise en charge et ouvre la décision', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([NADIA]))
    mockUpdateTeacherValidationStatus.mockResolvedValue({
      teacherId: NADIA.userId,
      status: 'in_review',
    } as never)

    renderPage()

    await screen.findByText('Nadia Lambert')
    await userEvent.click(screen.getByRole('button', { name: /prendre en charge/i }))

    await waitFor(() => {
      expect(mockUpdateTeacherValidationStatus).toHaveBeenCalledWith(NADIA.userId, {
        status: 'in_review',
      })
    })

    // La ligne reste dans la file, en cours d'examen, et ouvre la décision.
    await screen.findByRole('button', { name: /^valider$/i })
    expect(screen.getByRole('button', { name: /^refuser$/i })).toBeDefined()
    expect(screen.getByText("En cours d'examen")).toBeDefined()
    expect(mockFetchPendingTeachers).toHaveBeenCalledTimes(1)
  })

  it('retire la ligne validée sans relire toute la file', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([NADIA, SANS_EXPERTISE]))
    mockUpdateTeacherValidationStatus
      .mockResolvedValueOnce({ teacherId: NADIA.userId, status: 'in_review' } as never)
      .mockResolvedValueOnce({ teacherId: NADIA.userId, status: 'validated' } as never)

    renderPage()

    await screen.findByText('Nadia Lambert')
    const nadiaCard = screen.getByText('Nadia Lambert').closest('article') as HTMLElement
    await userEvent.click(within(nadiaCard).getByRole('button', { name: /prendre en charge/i }))
    await within(nadiaCard).findByRole('button', { name: /^valider$/i })
    await userEvent.click(within(nadiaCard).getByRole('button', { name: /^valider$/i }))

    await waitFor(() => {
      expect(screen.queryByText('Nadia Lambert')).toBeNull()
    })
    // L'autre dossier reste affiché, et rien n'a été rechargé.
    expect(screen.getByText('Yanis Roux')).toBeDefined()
    expect(mockFetchPendingTeachers).toHaveBeenCalledTimes(1)
  })

  it('joint le commentaire au refus', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([NADIA]))
    mockUpdateTeacherValidationStatus
      .mockResolvedValueOnce({ teacherId: NADIA.userId, status: 'in_review' } as never)
      .mockResolvedValueOnce({ teacherId: NADIA.userId, status: 'rejected' } as never)

    renderPage()

    await screen.findByText('Nadia Lambert')
    await userEvent.click(screen.getByRole('button', { name: /prendre en charge/i }))
    await screen.findByRole('button', { name: /^refuser$/i })
    await userEvent.click(screen.getByRole('button', { name: /ajouter un commentaire/i }))
    await userEvent.type(screen.getByLabelText(/commentaire/i), 'Diplôme non fourni')
    await userEvent.click(screen.getByRole('button', { name: /^refuser$/i }))

    await waitFor(() => {
      expect(mockUpdateTeacherValidationStatus).toHaveBeenLastCalledWith(NADIA.userId, {
        status: 'rejected',
        comment: 'Diplôme non fourni',
      })
    })
  })

  it('affiche le message du serveur quand une décision est refusée', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([NADIA]))
    mockUpdateTeacherValidationStatus.mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'Seul le technicien informatique peut sauter l’étape.' },
      },
    })

    renderPage()

    await screen.findByText('Nadia Lambert')
    await userEvent.click(screen.getByRole('button', { name: /prendre en charge/i }))

    await screen.findByText('Seul le technicien informatique peut sauter l’étape.')
  })

  it('donne accès à la fiche complète du formateur', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([NADIA]))

    renderPage()

    const link = await screen.findByRole('link', { name: /voir la fiche/i })
    expect(link.getAttribute('href')).toBe(`/profiles/${NADIA.userId}`)
  })

  it('pagine la file et demande la page suivante au serveur', async () => {
    mockFetchPendingTeachers.mockResolvedValue(
      buildPage([NADIA], { total: 40, totalPages: 2, page: 1 }),
    )

    renderPage()

    await screen.findByText('Nadia Lambert')
    expect(screen.getByText('Page 1 sur 2')).toBeDefined()
    expect(screen.getByRole('button', { name: /page précédente/i }).hasAttribute('disabled')).toBe(
      true,
    )

    mockFetchPendingTeachers.mockResolvedValue(
      buildPage([SANS_EXPERTISE], { total: 40, totalPages: 2, page: 2 }),
    )
    await userEvent.click(screen.getByRole('button', { name: /page suivante/i }))

    await waitFor(() => {
      expect(mockFetchPendingTeachers).toHaveBeenLastCalledWith(2)
    })
    await screen.findByText('Yanis Roux')
  })

  it('ne pagine pas quand tout tient sur une page', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([NADIA]))

    renderPage()

    await screen.findByText('Nadia Lambert')
    expect(screen.queryByRole('button', { name: /page suivante/i })).toBeNull()
  })

  it('relie la file à celle des demandes de professeur', async () => {
    mockFetchPendingTeachers.mockResolvedValue(buildPage([NADIA]))

    renderPage()

    await screen.findByText('Nadia Lambert')
    const workPlan = screen.getByRole('navigation', { name: /plan de travail/i })
    expect(
      within(workPlan).getByRole('link', { name: 'Demandes professeurs' }).getAttribute('href'),
    ).toBe('/teacher-requests')
    expect(
      within(workPlan).getByRole('link', { name: 'Nouveaux formateurs' }).getAttribute('href'),
    ).toBe('/rp/teacher-validations')
  })
})
