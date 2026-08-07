/**
 * Tests for ProfileEditPage
 *
 * Couvre :
 * - Chargement du profil via fetchProfile(userId)
 * - Préremplissage des formulaires administratif et pédagogique
 * - Payloads envoyés à profile-service — NOMS DE CHAMPS EXACTS
 * - Formes distinctes du profil pédagogique élève / formateur
 * - Succès, erreur, navigation
 *
 * ⚠️ Ces tests sont la barrière contre la régression qui a motivé ce lot : les
 * anciennes fixtures portaient les MÊMES noms erronés que le code de production
 * (`address`, `notes`, `subjects` en chaîne), donc elles restaient vertes alors
 * que le serveur répondait 400 ou écrivait dans la mauvaise table. Les payloads
 * sont désormais assertés en ÉGALITÉ STRICTE contre les noms de
 * `docs/routes.md` § « Noms de champs des profils » : réintroduire `address` ou
 * `notes` dans la page fait échouer ces tests.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileEditPage from '../../src/pages/ProfileEditPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchProfile, updateAdministrativeProfile, updatePedagogicalProfile } from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockUpdateAdministrativeProfile = vi.mocked(updateAdministrativeProfile)
const mockUpdatePedagogicalProfile = vi.mocked(updatePedagogicalProfile)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'formateur@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = STUDENT_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() => false),
  }
}

function renderEditPage(userId = 'student-1') {
  return render(
    <MemoryRouter initialEntries={[`/profiles/${userId}/edit`]}>
      <Routes>
        <Route path="/profiles/:userId/edit" element={<ProfileEditPage />} />
        <Route path="/profiles/:userId" element={<div>Profile Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * Forme réelle de `GET /profiles/:userId` : rubriques `administrative` /
 * `pedagogical` (clés courtes). Ne pas réintroduire les clés longues
 * `administrativeProfile` / `pedagogicalProfile` (routes `/internal/*`
 * uniquement) : le formulaire ne serait plus prérempli en réalité alors que ce
 * test resterait vert.
 *
 * Les NOMS DE CHAMPS ci-dessous sont ceux du serveur : l'adresse est découpée en
 * `addressLine1` / `addressLine2` (il n'existe pas de champ `address`), le champ
 * de besoins d'apprentissage est `specificNeeds` (il n'existe pas de `notes`) et
 * `subjects` est un tableau.
 */
const STUDENT_PROFILE = {
  userId: 'student-1',
  administrative: {
    firstName: 'Alice',
    lastName: 'Martin',
    phone: '0601020304',
    addressLine1: '1 rue de la Paix',
    addressLine2: 'Bâtiment C',
    postalCode: '75001',
    city: 'Paris',
  },
  pedagogical: {
    level: 'Terminale',
    subjects: ['Mathématiques', 'Physique-Chimie'],
    goals: 'Préparer le bac',
    specificNeeds: 'Tiers-temps',
  },
}

const TEACHER_PROFILE = {
  userId: 'teacher-1',
  administrative: { firstName: 'Bruno', lastName: 'Lefèvre' },
  pedagogical: {
    levels: ['Seconde', 'Terminale'],
    subjects: ['Mathématiques'],
    experience: '8 ans en lycée',
    testResults: 'Test interne validé',
  },
}

async function clickSaveButton() {
  const saveButtons = await screen.findAllByRole('button', { name: /enregistrer/i })
  await userEvent.click(saveButtons[0])
}

async function openPedagogicalTab() {
  const tabButton = await screen.findByRole('button', { name: /profil pédagogique/i })
  await userEvent.click(tabButton)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('ProfileEditPage', () => {
  it('shows loading state while fetching the profile', () => {
    mockFetchProfile.mockReturnValue(new Promise(() => {}))

    renderEditPage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('pre-fills the administrative form with existing data', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

    renderEditPage()

    await waitFor(() => {
      const firstNameInput = screen.getByPlaceholderText(/jean/i) as HTMLInputElement
      expect(firstNameInput.value).toBe('Alice')
    })
  })

  it('exposes both address lines, pre-filled independently', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

    renderEditPage()

    await waitFor(() => {
      const addressLine1Input = screen.getByLabelText('Adresse (ligne 1)') as HTMLInputElement
      expect(addressLine1Input.value).toBe('1 rue de la Paix')
    })
    const addressLine2Input = screen.getByLabelText('Adresse (ligne 2)') as HTMLInputElement
    expect(addressLine2Input.value).toBe('Bâtiment C')
  })

  it('submits the administrative profile with the exact server field names', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)
    mockUpdateAdministrativeProfile.mockResolvedValue({})

    renderEditPage()
    await clickSaveButton()

    await waitFor(() => {
      expect(mockUpdateAdministrativeProfile).toHaveBeenCalledWith('student-1', {
        firstName: 'Alice',
        lastName: 'Martin',
        phone: '0601020304',
        addressLine1: '1 rue de la Paix',
        addressLine2: 'Bâtiment C',
        // Champs non éditables ici mais renvoyés inchangés : une modification
        // d'adresse ne doit pas effacer le reste du profil.
        postalCode: '75001',
        city: 'Paris',
      })
    })
  })

  it('never sends back a field the server would reject with a 400', async () => {
    // Un bloc `administrative` contenant des clés hors contrat (nom français
    // historique, métadonnée technique) ne doit pas repartir dans le PUT :
    // `forbidNonWhitelisted` répondrait 400 sur l'ensemble du formulaire.
    mockFetchProfile.mockResolvedValue({
      userId: 'student-1',
      administrative: {
        firstName: 'Alice',
        telephone: '0601020304',
        address: '1 rue de la Paix',
        updatedAt: '2026-08-07T10:00:00.000Z',
      },
      pedagogical: null,
    })
    mockUpdateAdministrativeProfile.mockResolvedValue({})

    renderEditPage()
    await clickSaveButton()

    await waitFor(() => {
      expect(mockUpdateAdministrativeProfile).toHaveBeenCalledWith('student-1', {
        firstName: 'Alice',
      })
    })
  })

  it('shows success message after saving admin profile', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)
    mockUpdateAdministrativeProfile.mockResolvedValue({})

    renderEditPage()
    await clickSaveButton()

    await waitFor(() => {
      expect(screen.getByText('Profil administratif mis à jour')).toBeDefined()
    })
  })

  it('shows error message when save fails', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)
    mockUpdateAdministrativeProfile.mockRejectedValue({
      response: { data: { message: 'Données invalides' } },
    })

    renderEditPage()
    await clickSaveButton()

    await waitFor(() => {
      expect(screen.getByText('Données invalides')).toBeDefined()
    })
  })

  it('shows the pedagogical tab for élève role', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

    renderEditPage()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /profil pédagogique/i })).toBeDefined()
    })
  })

  it('switches to pedagogical tab on click', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

    renderEditPage()
    await openPedagogicalTab()

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/terminale/i)).toBeDefined()
    })
  })

  it('pre-fills the student pedagogical form, joining the subjects array', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

    renderEditPage()
    await openPedagogicalTab()

    await waitFor(() => {
      const subjectsInput = screen.getByLabelText('Matières concernées') as HTMLInputElement
      expect(subjectsInput.value).toBe('Mathématiques, Physique-Chimie')
    })
    const specificNeedsInput = screen.getByLabelText('Besoins spécifiques') as HTMLTextAreaElement
    expect(specificNeedsInput.value).toBe('Tiers-temps')
  })

  it('submits the student pedagogical profile with subjects as an array', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)
    mockUpdatePedagogicalProfile.mockResolvedValue({})

    renderEditPage()
    await openPedagogicalTab()
    await clickSaveButton()

    await waitFor(() => {
      expect(mockUpdatePedagogicalProfile).toHaveBeenCalledWith('student-1', {
        level: 'Terminale',
        goals: 'Préparer le bac',
        specificNeeds: 'Tiers-temps',
        subjects: ['Mathématiques', 'Physique-Chimie'],
      })
    })
  })

  it('splits a newly typed subjects list at the API boundary', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)
    mockUpdatePedagogicalProfile.mockResolvedValue({})

    renderEditPage()
    await openPedagogicalTab()

    const subjectsInput = await screen.findByLabelText('Matières concernées')
    await userEvent.clear(subjectsInput)
    await userEvent.type(subjectsInput, 'Algèbre,  Géométrie ,')

    await clickSaveButton()

    await waitFor(() => {
      expect(mockUpdatePedagogicalProfile).toHaveBeenCalledWith(
        'student-1',
        expect.objectContaining({ subjects: ['Algèbre', 'Géométrie'] }),
      )
    })
  })

  it('shows success message after saving pedagogical profile', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)
    mockUpdatePedagogicalProfile.mockResolvedValue({})

    renderEditPage()
    await openPedagogicalTab()
    await clickSaveButton()

    await waitFor(() => {
      expect(screen.getByText('Profil pédagogique mis à jour')).toBeDefined()
    })
  })

  it('navigates back to profile page when clicking "Retour"', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

    renderEditPage()

    await waitFor(() => {
      screen.getByText(/retour au profil/i)
    })

    await userEvent.click(screen.getByText(/retour au profil/i))

    await waitFor(() => {
      expect(screen.getByText('Profile Page')).toBeDefined()
    })
  })

  describe('profil pédagogique formateur', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    })

    it('renders the teacher field set, not the student one', async () => {
      mockFetchProfile.mockResolvedValue(TEACHER_PROFILE)

      renderEditPage('teacher-1')
      await openPedagogicalTab()

      await waitFor(() => {
        const levelsInput = screen.getByLabelText('Niveaux enseignés') as HTMLInputElement
        expect(levelsInput.value).toBe('Seconde, Terminale')
      })
      expect(screen.queryByLabelText('Niveau scolaire')).toBeNull()
      expect(screen.queryByLabelText('Objectifs pédagogiques')).toBeNull()
    })

    it('never sends student-only fields, which would create a student profile', async () => {
      mockFetchProfile.mockResolvedValue(TEACHER_PROFILE)
      mockUpdatePedagogicalProfile.mockResolvedValue({})

      renderEditPage('teacher-1')
      await openPedagogicalTab()
      await clickSaveButton()

      await waitFor(() => {
        expect(mockUpdatePedagogicalProfile).toHaveBeenCalledWith('teacher-1', {
          levels: ['Seconde', 'Terminale'],
          subjects: ['Mathématiques'],
          experience: '8 ans en lycée',
          testResults: 'Test interne validé',
        })
      })
    })

    it('uses the teacher form even when the pedagogical profile is empty', async () => {
      mockFetchProfile.mockResolvedValue({
        userId: 'teacher-1',
        administrative: { firstName: 'Bruno' },
        pedagogical: null,
      })

      renderEditPage('teacher-1')
      await openPedagogicalTab()

      await waitFor(() => {
        expect(screen.getByLabelText('Expérience pédagogique')).toBeDefined()
      })
    })
  })

  describe('édition par un RP sur le profil d’un tiers', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    })

    it('infers the student form from the data already recorded', async () => {
      mockFetchProfile.mockResolvedValue({ ...STUDENT_PROFILE, userId: 'student-9' })

      renderEditPage('student-9')
      await openPedagogicalTab()

      await waitFor(() => {
        expect(screen.getByLabelText('Niveau scolaire')).toBeDefined()
      })
    })

    it('infers the teacher form from the data already recorded', async () => {
      mockFetchProfile.mockResolvedValue({ ...TEACHER_PROFILE, userId: 'teacher-9' })

      renderEditPage('teacher-9')
      await openPedagogicalTab()

      await waitFor(() => {
        expect(screen.getByLabelText('Niveaux enseignés')).toBeDefined()
      })
    })

    it('offers no form when the profile shape cannot be determined', async () => {
      mockFetchProfile.mockResolvedValue({
        userId: 'someone-9',
        administrative: { firstName: 'Inconnu' },
        pedagogical: null,
      })

      renderEditPage('someone-9')
      await openPedagogicalTab()

      await waitFor(() => {
        expect(screen.getByText(/ne peut pas être déterminée/i)).toBeDefined()
      })
      expect(screen.queryByLabelText('Niveau scolaire')).toBeNull()
      expect(screen.queryByLabelText('Niveaux enseignés')).toBeNull()
    })
  })
})
