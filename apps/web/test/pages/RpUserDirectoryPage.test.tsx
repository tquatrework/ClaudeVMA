/**
 * RpUserDirectoryPage — `/rp/visualisation` (reconstruction du rail RP,
 * 2026-09-02, complétée le même jour pour couvrir les 4 rôles, puis à nouveau
 * pour exploiter le contrat réel confirmé par `docs/routes.md` : `avatarUrl`,
 * `level`, `levels`, `subjects`).
 *
 * Les 4 onglets (Élèves, Parents financeurs, Professeurs, Animateurs
 * pédagogiques) sont tous branchés sur la même route
 * `GET /profiles/directory/by-role?role=...`, chacun avec le rôle qui lui
 * correspond. Chaque tuile affiche prénom + nom (jamais l'UUID), une ligne
 * secondaire de niveau/matières quand pertinente, une photo quand
 * `avatarUrl` est renseigné (sinon des initiales, sans appel réseau), et
 * porte trois actions : Profil, Calendrier, Cahier de texte.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RpUserDirectoryPage from '../../src/pages/RpUserDirectoryPage'
import type { UserDirectoryEntry } from '../../src/types/profile'

vi.mock('../../src/api/profile')
vi.mock('../../src/hooks/useAuth')

import { fetchUserDirectoryByRole, fetchProfileAvatarBlob } from '../../src/api/profile'
import { useAuth } from '../../src/hooks/useAuth'

const mockFetchUserDirectoryByRole = vi.mocked(fetchUserDirectoryByRole)
const mockFetchProfileAvatarBlob = vi.mocked(fetchProfileAvatarBlob)

const mockUseAuth = vi.mocked(useAuth)

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  loginIdentifier: 'rp.test',
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: RP_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(RP_USER.role)),
    isInternalRole: vi.fn(() => true),
  }
}

/** Fixture complète — toujours les 7 champs du contrat réel (`docs/routes.md`). */
function buildEntry(overrides: Partial<UserDirectoryEntry> & { userId: string }): UserDirectoryEntry {
  return {
    firstName: null,
    lastName: null,
    avatarUrl: null,
    level: null,
    levels: null,
    subjects: null,
    ...overrides,
  }
}

function emptyPage() {
  return { data: [], page: 1, limit: 100, total: 0, totalPages: 1 }
}

function onePage(entry: UserDirectoryEntry) {
  return { data: [entry], page: 1, limit: 100, total: 1, totalPages: 1 }
}

function renderPage() {
  return render(
    <MemoryRouter>
      <RpUserDirectoryPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchUserDirectoryByRole.mockResolvedValue(emptyPage())
  mockFetchProfileAvatarBlob.mockRejectedValue(new Error('404 par défaut, pas de photo dans ces tests'))
})

describe('RpUserDirectoryPage', () => {
  it("affiche les élèves de l'annuaire avec un lien vers leur fiche, jamais leur UUID en libellé", async () => {
    mockFetchUserDirectoryByRole.mockImplementation(async (role) => {
      if (role === 'eleve') {
        return onePage(buildEntry({ userId: 'student-abc-123', firstName: 'Camille', lastName: 'Durand' }))
      }
      return emptyPage()
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Camille Durand')).toBeDefined()
    })

    expect(mockFetchUserDirectoryByRole).toHaveBeenCalledWith('eleve', 1, 100)
    expect(screen.queryByText('student-abc-123')).toBeNull()

    const main = within(screen.getByRole('main'))
    const link = main.getByRole('link', { name: 'Profil' })
    expect(link.getAttribute('href')).toBe('/profiles/student-abc-123')
  })

  it('chaque tuile porte exactement trois actions : Profil, Calendrier, Cahier de texte', async () => {
    mockFetchUserDirectoryByRole.mockImplementation(async (role) => {
      if (role === 'eleve') {
        return onePage(buildEntry({ userId: 'student-1', firstName: 'Jean', lastName: 'Petit' }))
      }
      return emptyPage()
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Jean Petit')).toBeDefined()
    })

    // Seul l'onglet « Élèves » (par défaut actif) est monté à ce stade — la
    // seule tuile affichée dans le contenu principal est celle de Jean Petit
    // (le rail et le menu du haut portent leurs propres liens, exclus ici).
    const main = within(screen.getByRole('main'))
    const links = main.getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(['Profil', 'Calendrier', 'Cahier de texte'])
    expect(links[0].getAttribute('href')).toBe('/profiles/student-1')
    expect(links[1].getAttribute('href')).toBe('/calendar?studentId=student-1')
    expect(links[2].getAttribute('href')).toBe('/pedagogical-log?studentId=student-1')
  })

  it("affiche le niveau suivi pour un élève, et jamais 'null'", async () => {
    mockFetchUserDirectoryByRole.mockImplementation(async (role) => {
      if (role === 'eleve') {
        return onePage(
          buildEntry({ userId: 'student-2', firstName: 'Nadia', lastName: 'Cohen', level: '4e' }),
        )
      }
      return emptyPage()
    })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Niveau : 4e')).toBeDefined()
    })
    expect(screen.queryByText(/null/i)).toBeNull()
  })

  it('affiche les niveaux enseignés et les matières pour un professeur, via le même mécanisme', async () => {
    mockFetchUserDirectoryByRole.mockImplementation(async (role) => {
      if (role === 'formateur') {
        return onePage(
          buildEntry({
            userId: 'teacher-2',
            firstName: 'Alice',
            lastName: 'Martin',
            levels: ['3e', '4e'],
            subjects: ['Algèbre'],
          }),
        )
      }
      return emptyPage()
    })

    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Professeurs' }))

    await waitFor(() => {
      expect(screen.getByText(/Niveaux : 3e, 4e/)).toBeDefined()
    })
    expect(screen.getByText(/Matières : Algèbre/)).toBeDefined()
  })

  it("n'affiche aucune ligne secondaire pour un parent financeur (aucun bloc pédagogique)", async () => {
    mockFetchUserDirectoryByRole.mockImplementation(async (role) => {
      if (role === 'parent_financeur') {
        return onePage(buildEntry({ userId: 'parent-1', firstName: 'Marc', lastName: 'Roussel' }))
      }
      return emptyPage()
    })

    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: 'Parents financeurs' }))

    await waitFor(() => {
      expect(screen.getByText('Marc Roussel')).toBeDefined()
    })
    expect(screen.queryByText(/Niveau/)).toBeNull()
  })

  it('affiche la photo quand avatarUrl est renseigné, jamais son UUID, et ne tente aucune requête sinon', async () => {
    mockFetchUserDirectoryByRole.mockImplementation(async (role) => {
      if (role === 'eleve') {
        return {
          data: [
            buildEntry({ userId: 'student-photo', firstName: 'Léo', lastName: 'Petit', avatarUrl: '/profiles/student-photo/avatar?v=1' }),
            buildEntry({ userId: 'student-no-photo', firstName: 'Sam', lastName: 'Ali' }),
          ],
          page: 1,
          limit: 100,
          total: 2,
          totalPages: 1,
        }
      }
      return emptyPage()
    })
    mockFetchProfileAvatarBlob.mockResolvedValue(new Blob(['fake-image'], { type: 'image/jpeg' }))

    const { container } = renderPage()

    await waitFor(() => {
      expect(screen.getByText('Léo Petit')).toBeDefined()
    })

    // Seule la personne avec un avatarUrl déclenche l'appel réseau de photo.
    await waitFor(() => {
      expect(mockFetchProfileAvatarBlob).toHaveBeenCalledWith('student-photo')
    })
    expect(mockFetchProfileAvatarBlob).not.toHaveBeenCalledWith('student-no-photo')

    // La tuile avec photo affiche exactement une <img> (alt="", décorative —
    // le nom est déjà affiché en texte à côté), la tuile sans photo garde ses
    // initiales, jamais son UUID.
    await waitFor(() => {
      const images = container.querySelectorAll('img')
      expect(images.length).toBe(1)
      expect(images[0].getAttribute('src')).toMatch(/^blob:/)
    })
    expect(screen.getByText('S')).toBeDefined() // initiale de Sam Ali
    expect(screen.queryByText('student-photo')).toBeNull()
    expect(screen.queryByText('student-no-photo')).toBeNull()
  })

  it('charge chaque onglet une seule fois, à sa première activation, et conserve son contenu ensuite', async () => {
    mockFetchUserDirectoryByRole.mockImplementation(async (role) => {
      if (role === 'formateur') {
        return onePage(buildEntry({ userId: 'teacher-1', firstName: 'Alice', lastName: 'Martin' }))
      }
      return emptyPage()
    })

    renderPage()

    // Onglet par défaut (Élèves) chargé au montage — le formateur ne l'est pas encore.
    await waitFor(() => {
      expect(mockFetchUserDirectoryByRole).toHaveBeenCalledWith('eleve', 1, 100)
    })
    expect(mockFetchUserDirectoryByRole).not.toHaveBeenCalledWith('formateur', 1, 100)

    await userEvent.click(screen.getByRole('tab', { name: 'Professeurs' }))
    await waitFor(() => {
      expect(screen.getByText('Alice Martin')).toBeDefined()
    })
    expect(mockFetchUserDirectoryByRole).toHaveBeenCalledTimes(2)

    // Retour sur Élèves puis re-retour sur Professeurs : pas de second appel.
    await userEvent.click(screen.getByRole('tab', { name: 'Élèves' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Professeurs' }))
    expect(screen.getByText('Alice Martin')).toBeDefined()
    expect(mockFetchUserDirectoryByRole).toHaveBeenCalledTimes(2)
  })

  it('affiche un état vide explicite quand un annuaire ne contient personne', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Aucun compte de type/i)).toBeDefined()
    })
  })

  it('les 4 onglets attendus sont présents, dans le bon ordre', async () => {
    renderPage()

    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Élèves',
      'Parents financeurs',
      'Professeurs',
      'Animateurs pédagogiques',
    ])

    // Laisse le chargement de l'onglet par défaut se résoudre avant la fin du
    // test, pour ne pas déclencher une mise à jour d'état hors `act()`.
    await waitFor(() => {
      expect(mockFetchUserDirectoryByRole).toHaveBeenCalled()
    })
  })
})
