/**
 * Tests de PedagogicalArchivePage — « Stats / Archives ».
 *
 * Ce que cet écran doit garantir, et que ces tests verrouillent :
 * - **soi-même par défaut**, sans manipulation ;
 * - le choix d'une autre personne se fait par prénom + nom, **jamais** par UUID ;
 * - on ne propose pas une action vouée au refus : les onglets d'archives
 *   disparaissent quand la nature du lien ne les ouvre pas (élève → son formateur) ;
 * - changer de personne consultée **redemande** les données ; changer d'onglet non ;
 * - un `404` est un état vide, un `503` est une erreur — la confusion entre les deux
 *   avait masqué pendant des semaines des routes montées sur le mauvais préfixe.
 */

import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import PedagogicalArchivePage from '../../src/pages/PedagogicalArchivePage'
import { expectNoTechnicalIdentifier, makeUseAuthReturn } from '../../src/test-helpers'
import type { MyContact } from '../../src/types/relations'
import {
  COURSE_SUMMARY_ITEM,
  NOTEBOOK_ENTRY_ITEM,
  PEDAGOGICAL_LOG_ITEM,
  TIMELINE_GROUPS,
  paginate,
} from '../fixtures/archives'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/archiveDocument')
vi.mock('../../src/api/relations')
// Le panneau de statistiques a ses propres tests ; on ne veut pas d'appel réseau ici.
vi.mock('../../src/components/profile/ProfileStatisticsPanel', () => ({
  default: ({ userId }: { userId: string }) => (
    <div data-testid="statistics-panel" data-user-id={userId}>
      Statistiques (mock)
    </div>
  ),
}))
vi.mock('../../src/hooks/profile/usePersonDisplayName', () => ({
  usePersonDisplayName: () => ({ displayName: 'Lina Archivet', isLoading: false }),
}))

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchPedagogicalArchives,
  fetchArchiveTimeline,
  downloadArchiveDocument,
} from '../../src/api/archiveDocument'
import { fetchMyContacts } from '../../src/api/relations'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchPedagogicalArchives = vi.mocked(fetchPedagogicalArchives)
const mockFetchArchiveTimeline = vi.mocked(fetchArchiveTimeline)
const mockDownloadArchiveDocument = vi.mocked(downloadArchiveDocument)
const mockFetchMyContacts = vi.mocked(fetchMyContacts)

const STUDENT_ID = 'fd0fe655-cd28-4f75-b225-846e8aad7e62'
const TEACHER_ID = '89968837-c4bb-455e-b4e4-5a8c86c23a79'
const PARENT_ID = '11cfb3a7-7866-4d72-ab9a-e078097940e5'

/** Contacts réels d'un élève : son professeur principal et son parent financeur. */
const STUDENT_CONTACTS: MyContact[] = [
  {
    userId: TEACHER_ID,
    firstName: 'Nadia',
    lastName: 'Formatrice',
    relations: [{ kind: 'student_of_teacher', isPrincipalTeacher: true }],
  },
  {
    userId: PARENT_ID,
    firstName: 'Paul',
    lastName: 'Archivet',
    relations: [{ kind: 'student_of_finance_owner' }],
  },
]

/** Contacts d'un formateur : son élève (archives ouvertes). */
const TEACHER_CONTACTS: MyContact[] = [
  {
    userId: STUDENT_ID,
    firstName: 'Lina',
    lastName: 'Archivet',
    relations: [{ kind: 'teacher_of_student', isPrincipalTeacher: true }],
  },
]

function renderPage(initialEntry = '/archives') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/archives" element={<PedagogicalArchivePage />} />
        <Route path="/archives/:personId" element={<PedagogicalArchivePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function asStudent() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: STUDENT_ID, role: 'eleve' }))
}

function asTeacher() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: TEACHER_ID, role: 'formateur' }))
}

function asParent() {
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: PARENT_ID, role: 'parent_financeur' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  asStudent()
  mockFetchMyContacts.mockResolvedValue([])
  mockFetchPedagogicalArchives.mockResolvedValue(paginate([]))
  mockFetchArchiveTimeline.mockResolvedValue(paginate([]))
  mockDownloadArchiveDocument.mockResolvedValue(new Blob(['data'], { type: 'application/pdf' }))
})

describe('PedagogicalArchivePage — personne consultée', () => {
  it("consulte l'utilisateur lui-même par défaut", async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByTestId('statistics-panel').getAttribute('data-user-id')).toBe(STUDENT_ID)
    })
    expect(mockFetchPedagogicalArchives).toHaveBeenCalledWith(STUDENT_ID)
  })

  it('liste les personnes reliées par prénom et nom, jamais par UUID', async () => {
    mockFetchMyContacts.mockResolvedValue(STUDENT_CONTACTS)

    const { container } = renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Nadia Formatrice/ })).toBeDefined()
    })
    expect(screen.getByRole('option', { name: /Mon professeur/ })).toBeDefined()
    expectNoTechnicalIdentifier(container)
  })

  it('recharge les données au changement de personne consultée', async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Lina Archivet/ })).toBeDefined()
    })
    mockFetchPedagogicalArchives.mockClear()

    await userEvent.selectOptions(screen.getByLabelText('Personne consultée'), STUDENT_ID)

    await waitFor(() => {
      expect(mockFetchPedagogicalArchives).toHaveBeenCalledWith(STUDENT_ID)
    })
  })

  it('annonce le contexte consulté et propose le retour à ses propres données', async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Lina Archivet/ })).toBeDefined()
    })
    await userEvent.selectOptions(screen.getByLabelText('Personne consultée'), STUDENT_ID)

    const returnButton = await screen.findByRole('button', { name: 'Revenir à mes données' })
    await userEvent.click(returnButton)

    await waitFor(() => {
      expect(screen.getByTestId('statistics-panel').getAttribute('data-user-id')).toBe(TEACHER_ID)
    })
  })

  it("ouvre directement la personne désignée par l'URL", async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)

    renderPage(`/archives/${STUDENT_ID}`)

    await waitFor(() => {
      expect(mockFetchPedagogicalArchives).toHaveBeenCalledWith(STUDENT_ID)
    })
  })

  it('explique l’absence de contact plutôt que de laisser un sélecteur muet', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Aucune personne reliée à votre compte/)).toBeDefined()
    })
  })

  it('reste utilisable si la lecture des contacts échoue', async () => {
    mockFetchMyContacts.mockRejectedValue({ response: { status: 500 } })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Vous pouvez consulter vos propres données/)).toBeDefined()
    })
    expect(screen.getByTestId('statistics-panel')).toBeDefined()
  })
})

describe('PedagogicalArchivePage — onglets proposés selon le lien', () => {
  it("n'offre que les statistiques d'un formateur à son élève", async () => {
    mockFetchMyContacts.mockResolvedValue(STUDENT_CONTACTS)

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Nadia Formatrice/ })).toBeDefined()
    })
    await userEvent.selectOptions(screen.getByLabelText('Personne consultée'), TEACHER_ID)

    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: 'Archives' })).toBeNull()
    })
    expect(screen.queryByRole('tab', { name: 'Résumés de cours' })).toBeNull()
    expect(screen.getByRole('tab', { name: 'Statistiques' })).toBeDefined()
  })

  it("offre les archives d'un élève à son formateur", async () => {
    asTeacher()
    mockFetchMyContacts.mockResolvedValue(TEACHER_CONTACTS)

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('option', { name: /Lina Archivet/ })).toBeDefined()
    })
    await userEvent.selectOptions(screen.getByLabelText('Personne consultée'), STUDENT_ID)

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Archives' })).toBeDefined()
    })
  })

  it('offre toujours ses propres archives à l’utilisateur', async () => {
    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: 'Archives' })).toBeDefined()
    })
  })
})

describe('PedagogicalArchivePage — contenu des archives', () => {
  beforeEach(() => {
    mockFetchPedagogicalArchives.mockResolvedValue(
      paginate([COURSE_SUMMARY_ITEM, PEDAGOGICAL_LOG_ITEM, NOTEBOOK_ENTRY_ITEM]),
    )
    mockFetchArchiveTimeline.mockResolvedValue(paginate(TIMELINE_GROUPS))
  })

  it('affiche la timeline groupée par date', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('tab', { name: 'Archives' }))

    await waitFor(() => {
      expect(screen.getByText('Résumé du cours du 3 mars')).toBeDefined()
    })
    expect(screen.getByText('Cahier de texte — équations')).toBeDefined()
    expect(screen.getByText('05/03/2026')).toBeDefined()
  })

  it('affiche le détail de l’élément sélectionné', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('tab', { name: 'Archives' }))
    await userEvent.click(await screen.findByText('Cahier de texte — équations'))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Télécharger' })).toBeDefined()
    })
  })

  it('lance le téléchargement du document choisi', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('tab', { name: 'Archives' }))
    await userEvent.click(await screen.findByText('Cahier de texte — équations'))
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger' }))

    await waitFor(() => {
      expect(mockDownloadArchiveDocument).toHaveBeenCalledWith(PEDAGOGICAL_LOG_ITEM.id)
    })
  })

  it('affiche l’échec de téléchargement sans casser la page', async () => {
    mockDownloadArchiveDocument.mockRejectedValue({ response: { status: 404 } })

    renderPage()

    await userEvent.click(await screen.findByRole('tab', { name: 'Archives' }))
    await userEvent.click(await screen.findByText('Cahier de texte — équations'))
    await userEvent.click(await screen.findByRole('button', { name: 'Télécharger' }))

    await waitFor(() => {
      expect(screen.getByText('Ressource introuvable.')).toBeDefined()
    })
  })

  it('refuse le carnet personnel au parent financeur', async () => {
    asParent()

    renderPage()

    await userEvent.click(await screen.findByRole('tab', { name: 'Archives' }))
    await userEvent.click(await screen.findByText('Note personnelle'))

    await waitFor(() => {
      expect(screen.getByText(/Ce document est réservé à l'élève/)).toBeDefined()
    })
  })

  it('affiche les résumés de cours dans leur onglet dédié', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('tab', { name: 'Résumés de cours' }))

    await waitFor(() => {
      expect(screen.getByText('Conservation permanente')).toBeDefined()
    })
  })

  it('ne recharge rien au changement d’onglet', async () => {
    renderPage()

    await waitFor(() => {
      expect(mockFetchPedagogicalArchives).toHaveBeenCalledTimes(1)
    })

    await userEvent.click(screen.getByRole('tab', { name: 'Archives' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Résumés de cours' }))
    await userEvent.click(screen.getByRole('tab', { name: 'Archives' }))

    expect(mockFetchPedagogicalArchives).toHaveBeenCalledTimes(1)
  })

  it('garde monté un onglet déjà visité', async () => {
    renderPage()

    await userEvent.click(await screen.findByRole('tab', { name: 'Archives' }))
    await screen.findByText('Résumé du cours du 3 mars')
    await userEvent.click(screen.getByRole('tab', { name: 'Statistiques' }))

    // Le panneau reste dans le DOM, simplement masqué : revenir dessus ne
    // reconstruit rien et ne perd rien.
    const timelinePanel = document.getElementById('tabpanel-timeline')
    expect(timelinePanel).not.toBeNull()
    expect(timelinePanel?.hasAttribute('hidden')).toBe(true)
    expect(within(timelinePanel as HTMLElement).getByText('Résumé du cours du 3 mars')).toBeDefined()
  })
})

describe('PedagogicalArchivePage — états vides et erreurs', () => {
  it('affiche un état vide sur 404, sans message d’erreur', async () => {
    mockFetchPedagogicalArchives.mockRejectedValue({ response: { status: 404 } })
    mockFetchArchiveTimeline.mockRejectedValue({ response: { status: 404 } })

    renderPage()

    await userEvent.click(await screen.findByRole('tab', { name: 'Archives' }))

    await waitFor(() => {
      expect(screen.getByText(/Aucune archive disponible/)).toBeDefined()
    })
    expect(screen.queryByText(/serveur rencontre un problème/i)).toBeNull()
  })

  it('affiche une vraie erreur sur 503 — pas un état vide trompeur', async () => {
    mockFetchPedagogicalArchives.mockRejectedValue({ response: { status: 503 } })
    mockFetchArchiveTimeline.mockRejectedValue({ response: { status: 503 } })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/serveur rencontre un problème/i)).toBeDefined()
    })
  })
})
