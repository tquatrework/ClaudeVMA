/**
 * Tests de MyStudentsPage (« Mes élèves »).
 *
 * Le test central : **un formateur voit ses élèves**. La page appelait
 * `GET /relations/finance-owner-student/:id` — la table financeur↔élève — et
 * servait donc `200 []` à un formateur : une liste vide, jamais un refus, et sans
 * message. C'était un défaut d'appel, pas de droit ; aucun test ne le voyait parce
 * qu'aucun ne rendait la page avec un formateur.
 *
 * Couvre : chargement, erreur, état vide, succès, filtrage des liens où
 * l'utilisateur est l'accompagné, et l'absence d'UUID à l'écran.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MyStudentsPage from '../../src/pages/MyStudentsPage'
import { expectNoTechnicalIdentifier, makeUseAuthReturn } from '../../src/test-helpers'
import type { MyContact } from '../../src/types/relations'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/relations')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchMyContacts } from '../../src/api/relations'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchMyContacts = vi.mocked(fetchMyContacts)

const STUDENT_CONTACT: MyContact = {
  userId: 'fd0fe655-cd28-4f75-b225-846e8aad7e62',
  firstName: 'Lina',
  lastName: 'Archivet',
  relations: [{ kind: 'teacher_of_student', isPrincipalTeacher: true }],
}

const ANIMATOR_CONTACT: MyContact = {
  userId: '46c50802-0c6f-4fee-84a6-e623f62cc141',
  firstName: 'Omar',
  lastName: 'Animateur',
  relations: [{ kind: 'teacher_of_animator' }],
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyStudentsPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'teacher-1', role: 'formateur' }))
})

describe('MyStudentsPage', () => {
  it('affiche un état de chargement pendant la lecture des contacts', () => {
    mockFetchMyContacts.mockReturnValue(new Promise(() => {}))

    renderPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('affiche un message quand la lecture des contacts échoue', async () => {
    mockFetchMyContacts.mockRejectedValue({ response: { status: 500 } })

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/serveur rencontre un problème/i)).toBeDefined()
    })
  })

  it('affiche les élèves du FORMATEUR — le défaut corrigé le 2026-08-11', async () => {
    mockFetchMyContacts.mockResolvedValue([STUDENT_CONTACT])

    const { container } = renderPage()

    await waitFor(() => {
      expect(screen.getByText('Lina Archivet')).toBeDefined()
    })
    expect(screen.getByText('Mon élève')).toBeDefined()
    expectNoTechnicalIdentifier(container)
  })

  it("écarte les liens où l'utilisateur est l'accompagné, pas l'accompagnant", async () => {
    mockFetchMyContacts.mockResolvedValue([STUDENT_CONTACT, ANIMATOR_CONTACT])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText('Lina Archivet')).toBeDefined()
    })
    expect(screen.queryByText('Omar Animateur')).toBeNull()
  })

  it('propose « Stats / Archives » pour chaque personne accompagnée', async () => {
    mockFetchMyContacts.mockResolvedValue([STUDENT_CONTACT])

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Stats / Archives' })).toBeDefined()
    })
  })

  it('affiche un état vide sans proposer le rattachement à un formateur', async () => {
    mockFetchMyContacts.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByText(/Aucune personne rattachée/)).toBeDefined()
    })
    expect(screen.queryByRole('link', { name: 'Rattacher un élève' })).toBeNull()
  })

  it('propose le rattachement au parent financeur sans élève', async () => {
    mockUseAuth.mockReturnValue(makeUseAuthReturn({ id: 'parent-1', role: 'parent_financeur' }))
    mockFetchMyContacts.mockResolvedValue([])

    renderPage()

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Rattacher un élève' })).toBeDefined()
    })
  })

  it("affiche un repli lisible quand la personne n'a pas de profil administratif", async () => {
    mockFetchMyContacts.mockResolvedValue([
      { ...STUDENT_CONTACT, firstName: null, lastName: null },
    ])

    const { container } = renderPage()

    await waitFor(() => {
      expect(screen.getByText('Contact (nom non renseigné)')).toBeDefined()
    })
    expectNoTechnicalIdentifier(container)
  })
})
