/**
 * Tests de ProfileEditPage
 *
 * L'écran porte trois routes d'écriture distinctes, une par onglet :
 * - « Profil administratif » → `PUT /profiles/:userId/administrative` ;
 * - « Profil pédagogique »   → `PUT /profiles/:userId/pedagogical` (section
 *   déclarative, écrite par le titulaire) ;
 * - « Préconisations »       → `PUT /profiles/:userId/prescription`, **RP seul**.
 *
 * Deux régressions sont gardées ici :
 *
 * 1. les payloads sont assertés en ÉGALITÉ STRICTE contre les noms de
 *    `docs/routes.md` § « Noms de champs des profils ». Les anciennes fixtures
 *    portaient les mêmes noms erronés que le code (`address`, `notes`,
 *    `subjects` en chaîne) et restaient vertes pendant que le serveur répondait
 *    400 ;
 * 2. le bloc `pedagogical` arrive **à plat**, prescription comprise. Renvoyer un
 *    champ de prescription à `PUT .../pedagogical` renvoie 400 : les tests de
 *    soumission vérifient donc que rien de la prescription ne repart, alors même
 *    que la fixture en contient.
 *
 * Les libellés attendus sont en français (règle projet du 2026-08-09) et
 * proviennent du point unique `src/utils/profileFieldLabels.ts`.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileEditPage from '../../src/pages/ProfileEditPage'
import { ADMINISTRATIVE_FIELD_NAMES } from '../../src/utils/profileFields'
import { getProfileFieldLabel } from '../../src/utils/profileFieldLabels'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchProfile,
  updateAdministrativeProfile,
  updatePedagogicalProfile,
  updatePrescription,
} from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockUpdateAdministrativeProfile = vi.mocked(updateAdministrativeProfile)
const mockUpdatePedagogicalProfile = vi.mocked(updatePedagogicalProfile)
const mockUpdatePrescription = vi.mocked(updatePrescription)

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
 * `pedagogical` (clés courtes ; les clés longues n'existent plus depuis
 * l'arbitrage du 2026-08-08), plus `pedagogicalType`, **source autoritative** de
 * la forme du profil.
 *
 * `pedagogical` mêle volontairement ici déclaratif et prescription : c'est ce
 * que le serveur renvoie, et c'est le front qui doit les séparer à l'écriture.
 */
const STUDENT_PROFILE = {
  userId: 'student-1',
  loginIdentifier: 'alice.martin',
  pedagogicalType: 'student' as const,
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
    // Section déclarative — écrite par l'élève.
    level: 'Terminale',
    subjects: ['Mathématiques', 'Physique-Chimie'],
    goals: 'Préparer le bac',
    specificNeeds: 'Tiers-temps',
    difficulties: 'Les fonctions dérivées',
    context: 'Changement de lycée en cours d’année',
    // Section prescription — écrite par le RP, lue par l'élève, jamais renvoyée
    // par le formulaire déclaratif.
    generalAssessment: 'Élève sérieuse et régulière',
    recommendedPace: 'Deux séances hebdomadaires',
    recommendedTeacherProfile: 'Formateur habitué à la remise en confiance',
    recommendedPath: 'Remise à niveau puis préparation au bac',
    recommendedActivities: 'Exercices guidés hebdomadaires',
    filledBy: 'rp-1',
    filledAt: '2026-08-09T10:00:00.000Z',
  },
}

const TEACHER_PROFILE = {
  userId: 'teacher-1',
  loginIdentifier: 'bruno.lefevre',
  pedagogicalType: 'teacher' as const,
  administrative: { firstName: 'Bruno', lastName: 'Lefèvre' },
  pedagogical: {
    // Section déclarative — écrite par le formateur.
    levels: ['Seconde', 'Terminale'],
    subjects: ['Mathématiques'],
    experience: '8 ans en lycée',
    diplomas: 'Agrégation de mathématiques',
    specialties: ['Préparation Grand Oral', 'Remise à niveau'],
    particularities: 'Cours en soirée, accompagnement d’élèves DYS',
    cvDocumentId: 'cv-2026-0042',
    // Droit attribué par POST /profiles/:teacherId/ap-status : jamais réécrit ici.
    isAnimateurPedagogique: true,
    // Section prescription — écrite par le RP.
    maxValidatedLevel: 'Terminale spécialité mathématiques',
    audienceType: 'Collège et lycée',
    testResults: 'Test interne validé',
    testComments: 'Très bonne maîtrise disciplinaire',
    filledBy: 'rp-1',
    filledAt: '2026-08-09T10:00:00.000Z',
  },
}

async function clickSaveButton() {
  const saveButtons = await screen.findAllByRole('button', { name: /enregistrer/i })
  await userEvent.click(saveButtons[0])
}

async function openTab(tabLabel: RegExp) {
  const tabButton = await screen.findByRole('tab', { name: tabLabel })
  await userEvent.click(tabButton)
}

const openPedagogicalTab = () => openTab(/profil pédagogique/i)
const openPrescriptionTab = () => openTab(/préconisations/i)

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
      const firstNameInput = screen.getByLabelText('Prénom') as HTMLInputElement
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

  it('expose les 12 champs administratifs du contrat, aucun de moins', async () => {
    // `avatarUrl` et `passions` étaient chargés, conservés et renvoyés au
    // serveur, mais absents de l'écran : impossibles à renseigner (2026-08-09).
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

    renderEditPage()

    await waitFor(() => {
      expect(screen.getByLabelText('Prénom')).toBeDefined()
    })

    const expectedLabels = ADMINISTRATIVE_FIELD_NAMES.map((fieldName) =>
      getProfileFieldLabel(fieldName),
    )
    for (const label of expectedLabels) {
      expect(screen.getByLabelText(label)).toBeDefined()
    }
    expect(expectedLabels).toHaveLength(12)
  })

  it('convertit les centres d’intérêt en tableau à la frontière API', async () => {
    mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)
    mockUpdateAdministrativeProfile.mockResolvedValue({})

    renderEditPage()

    await waitFor(() => {
      expect(screen.getByLabelText("Centres d'intérêt")).toBeDefined()
    })

    await userEvent.type(screen.getByLabelText("Centres d'intérêt"), 'Échecs, Piano')
    await userEvent.type(screen.getByLabelText('Photo de profil'), 'https://exemple.fr/photo.jpg')
    await clickSaveButton()

    await waitFor(() => {
      expect(mockUpdateAdministrativeProfile).toHaveBeenCalledWith(
        'student-1',
        expect.objectContaining({
          passions: ['Échecs', 'Piano'],
          avatarUrl: 'https://exemple.fr/photo.jpg',
        }),
      )
    })
  })

  it('n’envoie pas une chaîne vide sur un champ laissé vide', async () => {
    // Le serveur refuse une chaîne vide sur firstName/lastName/phone (400) ;
    // un champ absent vaut « ne rien changer ».
    mockFetchProfile.mockResolvedValue({
      userId: 'student-1',
      pedagogicalType: null,
      administrative: { firstName: 'Alice', lastName: 'Martin' },
      pedagogical: null,
    })
    mockUpdateAdministrativeProfile.mockResolvedValue({})

    renderEditPage()
    await clickSaveButton()

    await waitFor(() => {
      expect(mockUpdateAdministrativeProfile).toHaveBeenCalledWith('student-1', {
        firstName: 'Alice',
        lastName: 'Martin',
      })
    })
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
      pedagogicalType: null,
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

  describe('section déclarative — profil élève', () => {
    it('shows the pedagogical tab but never the prescription tab', async () => {
      mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

      renderEditPage()

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: /profil pédagogique/i })).toBeDefined()
      })
      // Le titulaire lit sa prescription sur sa fiche, il ne l'édite jamais :
      // afficher l'onglet mènerait droit au 403.
      expect(screen.queryByRole('tab', { name: /préconisations/i })).toBeNull()
    })

    it('renders every declarative field, with its French label', async () => {
      mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

      renderEditPage()
      await openPedagogicalTab()

      await waitFor(() => {
        expect(screen.getByLabelText('Niveau scolaire')).toBeDefined()
      })
      expect(screen.getByLabelText('Matières')).toBeDefined()
      expect(screen.getByLabelText('Objectifs pédagogiques')).toBeDefined()
      expect(screen.getByLabelText('Difficultés rencontrées')).toBeDefined()
      expect(screen.getByLabelText('Besoins spécifiques (aménagements)')).toBeDefined()
      expect(screen.getByLabelText('Contexte scolaire et familial')).toBeDefined()
    })

    it('pre-fills the new declarative fields and joins the subjects array', async () => {
      mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

      renderEditPage()
      await openPedagogicalTab()

      await waitFor(() => {
        const subjectsInput = screen.getByLabelText('Matières') as HTMLInputElement
        expect(subjectsInput.value).toBe('Mathématiques, Physique-Chimie')
      })
      const difficultiesInput = screen.getByLabelText(
        'Difficultés rencontrées',
      ) as HTMLTextAreaElement
      expect(difficultiesInput.value).toBe('Les fonctions dérivées')
      const contextInput = screen.getByLabelText(
        'Contexte scolaire et familial',
      ) as HTMLTextAreaElement
      expect(contextInput.value).toBe('Changement de lycée en cours d’année')
      const specificNeedsInput = screen.getByLabelText(
        'Besoins spécifiques (aménagements)',
      ) as HTMLTextAreaElement
      expect(specificNeedsInput.value).toBe('Tiers-temps')
    })

    it('never offers a prescription field for editing', async () => {
      mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)

      renderEditPage()
      await openPedagogicalTab()

      await waitFor(() => {
        expect(screen.getByLabelText('Niveau scolaire')).toBeDefined()
      })
      expect(screen.queryByLabelText('Considération générale')).toBeNull()
      expect(screen.queryByLabelText('Type de formateur préconisé')).toBeNull()
      expect(screen.queryByLabelText('Rempli par')).toBeNull()
    })

    it('submits only the declarative section, subjects as an array', async () => {
      mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)
      mockUpdatePedagogicalProfile.mockResolvedValue({})

      renderEditPage()
      await openPedagogicalTab()
      await clickSaveButton()

      await waitFor(() => {
        // Égalité stricte : aucun champ de prescription, aucun `filledBy` /
        // `filledAt`, alors que la fixture en contient — sinon le serveur
        // répondrait 400 sur l'ensemble du formulaire.
        expect(mockUpdatePedagogicalProfile).toHaveBeenCalledWith('student-1', {
          level: 'Terminale',
          subjects: ['Mathématiques', 'Physique-Chimie'],
          goals: 'Préparer le bac',
          specificNeeds: 'Tiers-temps',
          difficulties: 'Les fonctions dérivées',
          context: 'Changement de lycée en cours d’année',
        })
      })
    })

    it('splits a newly typed subjects list at the API boundary', async () => {
      mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)
      mockUpdatePedagogicalProfile.mockResolvedValue({})

      renderEditPage()
      await openPedagogicalTab()

      const subjectsInput = await screen.findByLabelText('Matières')
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

    it('explains a 400 on a field belonging to the other section', async () => {
      mockFetchProfile.mockResolvedValue(STUDENT_PROFILE)
      mockUpdatePedagogicalProfile.mockRejectedValue({
        response: {
          status: 400,
          data: { message: ['property generalAssessment should not exist'] },
        },
      })

      renderEditPage()
      await openPedagogicalTab()
      await clickSaveButton()

      await waitFor(() => {
        expect(screen.getByText(/ne relèvent pas de ce profil/i)).toBeDefined()
      })
    })
  })

  describe('section déclarative — profil formateur', () => {
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
      expect(screen.getByLabelText('Diplômes et certifications')).toBeDefined()
      expect(screen.getByLabelText("Spécialités d'accompagnement")).toBeDefined()
      expect(screen.getByLabelText('Particularités et modalités')).toBeDefined()
      expect(screen.getByLabelText('CV (référence du document)')).toBeDefined()
      expect(screen.queryByLabelText('Niveau scolaire')).toBeNull()
      expect(screen.queryByLabelText('Objectifs pédagogiques')).toBeNull()
      expect(screen.queryByLabelText('Difficultés rencontrées')).toBeNull()
    })

    it('pre-fills the new teacher declarative fields', async () => {
      mockFetchProfile.mockResolvedValue(TEACHER_PROFILE)

      renderEditPage('teacher-1')
      await openPedagogicalTab()

      await waitFor(() => {
        const specialtiesInput = screen.getByLabelText(
          "Spécialités d'accompagnement",
        ) as HTMLInputElement
        expect(specialtiesInput.value).toBe('Préparation Grand Oral, Remise à niveau')
      })
      const diplomasInput = screen.getByLabelText(
        'Diplômes et certifications',
      ) as HTMLTextAreaElement
      expect(diplomasInput.value).toBe('Agrégation de mathématiques')
      const cvInput = screen.getByLabelText('CV (référence du document)') as HTMLInputElement
      expect(cvInput.value).toBe('cv-2026-0042')
    })

    it('sends neither student fields, prescription fields nor the AP right', async () => {
      mockFetchProfile.mockResolvedValue(TEACHER_PROFILE)
      mockUpdatePedagogicalProfile.mockResolvedValue({})

      renderEditPage('teacher-1')
      await openPedagogicalTab()
      await clickSaveButton()

      await waitFor(() => {
        // `testResults` et `isAnimateurPedagogique` sont dans la fixture et
        // doivent rester au vestiaire : le premier appartient à la prescription
        // du RP, le second est un droit attribué par `POST .../ap-status`.
        expect(mockUpdatePedagogicalProfile).toHaveBeenCalledWith('teacher-1', {
          levels: ['Seconde', 'Terminale'],
          subjects: ['Mathématiques'],
          experience: '8 ans en lycée',
          diplomas: 'Agrégation de mathématiques',
          specialties: ['Préparation Grand Oral', 'Remise à niveau'],
          particularities: 'Cours en soirée, accompagnement d’élèves DYS',
          cvDocumentId: 'cv-2026-0042',
        })
      })
    })

    it('uses the teacher form even when the pedagogical profile is empty', async () => {
      // `pedagogicalType: null` est l'état NORMAL d'un profil jamais renseigné :
      // le rôle du titulaire prend alors le relais.
      mockFetchProfile.mockResolvedValue({
        userId: 'teacher-1',
        pedagogicalType: null,
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

  describe('prescription — responsable pédagogique', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    })

    it('renders the prescription fields with their French labels', async () => {
      mockFetchProfile.mockResolvedValue({ ...STUDENT_PROFILE, userId: 'student-9' })

      renderEditPage('student-9')
      await openPrescriptionTab()

      await waitFor(() => {
        expect(screen.getByLabelText('Considération générale')).toBeDefined()
      })
      expect(screen.getByLabelText('Rythme préconisé')).toBeDefined()
      expect(screen.getByLabelText('Type de formateur préconisé')).toBeDefined()
      expect(screen.getByLabelText('Parcours préconisé')).toBeDefined()
      expect(screen.getByLabelText('Activités préconisées')).toBeDefined()
      // `filledBy` / `filledAt` sont posés par le serveur : jamais saisis.
      expect(screen.queryByLabelText('Rempli par')).toBeNull()
      expect(screen.queryByLabelText('Rempli le')).toBeNull()
    })

    it('submits the student prescription through its dedicated route', async () => {
      mockFetchProfile.mockResolvedValue({ ...STUDENT_PROFILE, userId: 'student-9' })
      mockUpdatePrescription.mockResolvedValue({})

      renderEditPage('student-9')
      await openPrescriptionTab()
      await clickSaveButton()

      await waitFor(() => {
        expect(mockUpdatePrescription).toHaveBeenCalledWith('student-9', {
          generalAssessment: 'Élève sérieuse et régulière',
          recommendedPace: 'Deux séances hebdomadaires',
          recommendedTeacherProfile: 'Formateur habitué à la remise en confiance',
          recommendedPath: 'Remise à niveau puis préparation au bac',
          recommendedActivities: 'Exercices guidés hebdomadaires',
        })
      })
      expect(mockUpdatePedagogicalProfile).not.toHaveBeenCalled()
      expect(screen.getByText('Préconisations enregistrées')).toBeDefined()
    })

    it('submits the teacher prescription, test results included', async () => {
      mockFetchProfile.mockResolvedValue({ ...TEACHER_PROFILE, userId: 'teacher-9' })
      mockUpdatePrescription.mockResolvedValue({})

      renderEditPage('teacher-9')
      await openPrescriptionTab()

      await waitFor(() => {
        expect(screen.getByLabelText('Résultats des tests')).toBeDefined()
      })
      await clickSaveButton()

      await waitFor(() => {
        expect(mockUpdatePrescription).toHaveBeenCalledWith('teacher-9', {
          maxValidatedLevel: 'Terminale spécialité mathématiques',
          audienceType: 'Collège et lycée',
          testResults: 'Test interne validé',
          testComments: 'Très bonne maîtrise disciplinaire',
        })
      })
    })

    it('explains a 403 without pretending the profile was saved', async () => {
      mockFetchProfile.mockResolvedValue({ ...STUDENT_PROFILE, userId: 'student-9' })
      mockUpdatePrescription.mockRejectedValue({ response: { status: 403, data: {} } })

      renderEditPage('student-9')
      await openPrescriptionTab()
      await clickSaveButton()

      await waitFor(() => {
        expect(
          screen.getByText(/rédigée par le responsable pédagogique/i),
        ).toBeDefined()
      })
      expect(screen.queryByText('Préconisations enregistrées')).toBeNull()
    })

    it('trusts the server-declared pedagogicalType over its own role', async () => {
      // Le RP est formateur au sens du profil pédagogique ; sans
      // `pedagogicalType`, l'écran pourrait proposer le mauvais jeu de champs.
      mockFetchProfile.mockResolvedValue({ ...STUDENT_PROFILE, userId: 'student-9' })

      renderEditPage('student-9')
      await openPedagogicalTab()

      await waitFor(() => {
        expect(screen.getByLabelText('Niveau scolaire')).toBeDefined()
      })
      expect(screen.queryByLabelText('Niveaux enseignés')).toBeNull()
    })

    it('infers the teacher form from the data already recorded', async () => {
      mockFetchProfile.mockResolvedValue({
        ...TEACHER_PROFILE,
        userId: 'teacher-9',
        pedagogicalType: null,
      })

      renderEditPage('teacher-9')
      await openPedagogicalTab()

      await waitFor(() => {
        expect(screen.getByLabelText('Niveaux enseignés')).toBeDefined()
      })
    })

    it('offers no form when the profile shape cannot be determined', async () => {
      mockFetchProfile.mockResolvedValue({
        userId: 'someone-9',
        pedagogicalType: null,
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
