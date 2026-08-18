/**
 * Tests for ProfilePage
 *
 * Covers:
 * - Fetches profile via fetchProfile(userId)
 * - Loading state
 * - Error states (403, 404, 500)
 * - Shows edit button for own profile or privileged roles
 * - Internal notes section shown only for RP / administrateur_financier
 * - Teacher relations section shown for authorised roles
 * - Can add an internal note via createInternalNote(userId, content)
 *
 * Note : `TeacherValidationPanel` (RP/TI) et `ProfileStatisticsPanel` (onglet
 * pédagogique) sont montés en tant qu'enfants de ProfilePage mais ne font pas
 * partie de ce lot de migration — leurs dépendances (`api/client`,
 * `fetchProfileStatistics`) sont mockées ici uniquement pour éviter tout appel
 * réseau réel pendant ces tests, sans changer leur comportement.
 */

import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfilePage from '../../src/pages/ProfilePage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')
vi.mock('../../src/api/profile')
vi.mock('../../src/api/relations')
vi.mock('../../src/api/accounts')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'
import {
  fetchProfile,
  fetchInternalNotes,
  createInternalNote,
  fetchProfileStatistics,
  updateAdministrativeProfile,
} from '../../src/api/profile'
import { fetchTeacherStudentRelations, unlinkTeacherStudentRelation } from '../../src/api/relations'
import { fetchConsents } from '../../src/api/accounts'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)
const mockFetchProfile = vi.mocked(fetchProfile)
const mockUpdateAdministrativeProfile = vi.mocked(updateAdministrativeProfile)
const mockFetchInternalNotes = vi.mocked(fetchInternalNotes)
const mockCreateInternalNote = vi.mocked(createInternalNote)
const mockFetchProfileStatistics = vi.mocked(fetchProfileStatistics)
const mockFetchTeacherStudentRelations = vi.mocked(fetchTeacherStudentRelations)
const mockUnlinkTeacherStudentRelation = vi.mocked(unlinkTeacherStudentRelation)
const mockFetchConsents = vi.mocked(fetchConsents)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const PARENT_USER = {
  id: 'parent-1',
  email: 'parent@test.com',
  role: 'parent_financeur' as const,
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
    isInternalRole: vi.fn(() =>
      (['responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier'] as string[]).includes(userObj.role),
    ),
  }
}

function renderProfilePage(userId = 'student-1') {
  return render(
    <MemoryRouter initialEntries={[`/profiles/${userId}`]}>
      <Routes>
        <Route path="/profiles/:userId" element={<ProfilePage />} />
        <Route path="/profiles/:userId/edit" element={<div>Edit Profile Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

/**
 * Forme réelle de `GET /profiles/:userId` : rubriques `administrative` /
 * `pedagogical` (clés courtes). Ne pas réintroduire `administrativeProfile` /
 * `pedagogicalProfile` : ces clés longues n'existent plus nulle part depuis
 * l'arbitrage du 2026-08-08 (un seul nom par donnée, voir `docs/architecture.md`),
 * y compris sur les routes `/internal/*` qui les portaient encore. Une fixture aux
 * clés longues rendrait ce test vert alors que l'écran est vide en réalité.
 */
const SAMPLE_PROFILE = {
  userId: 'student-1',
  administrative: { firstName: 'Marie', lastName: 'Dupont', phone: '0612345678' },
  // `subjects` est un `string[]` côté profile-service, jamais une chaîne.
  pedagogical: { level: 'Terminale', subjects: ['Mathématiques', 'Physique-Chimie'] },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  // Dépendance non migrée (TeacherValidationPanel) — évite tout appel réseau réel.
  mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
  mockFetchTeacherStudentRelations.mockResolvedValue([])
  mockFetchInternalNotes.mockResolvedValue([])
  mockFetchProfileStatistics.mockResolvedValue({})
  mockFetchConsents.mockResolvedValue([])
})

describe('ProfilePage', () => {
  it('shows loading state while fetching', () => {
    mockFetchProfile.mockReturnValue(new Promise(() => {}))

    renderProfilePage()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders administrative and pedagogical profile sections', async () => {
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

    renderProfilePage()

    await waitFor(() => {
      // Les onglets "Profil administratif" et "Profil pédagogique" apparaissent dans la barre de navigation
      const adminTabs = screen.getAllByText('Profil administratif')
      expect(adminTabs.length).toBeGreaterThanOrEqual(1)
      expect(screen.getByRole('tab', { name: 'Profil pédagogique' })).toBeDefined()
    })
  })

  it('displays field values from the profile', async () => {
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

    renderProfilePage()

    // Onglet "Profil administratif" actif par défaut. Le titulaire a le droit
    // d'écriture : ses champs sont des zones de saisie pré-remplies.
    await waitFor(() => {
      expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Marie')
    })
    expect((screen.getByLabelText('Téléphone') as HTMLInputElement).value).toBe('0612345678')

    // Naviguer vers l'onglet "Profil pédagogique" pour voir les données pédagogiques
    const pedagogiqueTab = await screen.findByRole('tab', { name: 'Profil pédagogique' })
    fireEvent.click(pedagogiqueTab)

    await waitFor(() => {
      expect((screen.getByLabelText('Niveau scolaire') as HTMLInputElement).value).toBe('Terminale')
    })
    // Un champ tableau se saisit en liste lisible, jamais en JSON brut.
    expect((screen.getByLabelText('Matières') as HTMLInputElement).value).toBe(
      'Mathématiques, Physique-Chimie',
    )
  })

  it("n'affiche ni l'UUID du compte ni de libellé anglais dans l'onglet administratif", async () => {
    // Le serveur renvoie le bloc `administrative` avec ses champs techniques :
    // affiché tel quel, il faisait apparaître « User id », « Created at » et
    // « Updated at » à l'écran (constat du 2026-08-09 sur la pile réelle).
    mockFetchProfile.mockResolvedValue({
      ...SAMPLE_PROFILE,
      administrative: {
        userId: '464da8a2-8b4f-4cc7-b7b1-f1d0ab511355',
        firstName: 'Nina',
        lastName: 'Profil',
        birthDate: '2008-05-14',
        createdAt: '2026-08-09T18:13:49.000Z',
        updatedAt: '2026-08-09T18:13:49.000Z',
      },
    })

    renderProfilePage()

    await waitFor(() => {
      expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Nina')
    })

    // L'UUID n'est pas une donnée de fiche : ni sa valeur, ni son libellé.
    expect(screen.queryByText('464da8a2-8b4f-4cc7-b7b1-f1d0ab511355')).toBeNull()
    expect(screen.queryByText('User id')).toBeNull()
    expect(screen.queryByLabelText('User id')).toBeNull()

    // La traçabilité reste lisible, en français, et en lecture seule : elle est
    // posée par le serveur, l'envoyer vaudrait 400.
    expect(screen.queryByText('Created at')).toBeNull()
    expect(screen.queryByText('Updated at')).toBeNull()
    expect(screen.getByText('Profil créé le')).toBeDefined()
    expect(screen.getByText('Dernière modification')).toBeDefined()
    expect(screen.queryByLabelText('Profil créé le')).toBeNull()
  })

  /**
   * Cœur du correctif du 2026-08-09 : sur la pile réelle, tous les profils sont
   * vides sauf prénom et nom. Une fiche qui n'affiche que ce qui est rempli ne
   * montre que quatre lignes — et l'utilisateur conclut que rien n'est
   * implémenté, alors qu'il a le droit de tout remplir.
   */
  describe('profil entièrement vide', () => {
    const EMPTY_PROFILE = {
      userId: 'student-1',
      administrative: { userId: 'student-1', firstName: 'Marie', lastName: 'Dupont' },
      pedagogical: null,
      pedagogicalType: null,
    }

    it('offre les 10 champs administratifs en saisie au titulaire', async () => {
      mockFetchProfile.mockResolvedValue(EMPTY_PROFILE)

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByLabelText('Prénom')).toBeDefined()
      })

      for (const label of [
        'Prénom',
        'Nom',
        'Date de naissance',
        'Téléphone',
        'Adresse (ligne 1)',
        'Adresse (ligne 2)',
        'Code postal',
        'Ville',
        'Pays',
        "Centres d'intérêt",
      ]) {
        const field = screen.getByLabelText(label) as HTMLInputElement
        expect(field).toBeDefined()
        expect(field.disabled).toBe(false)
      }
    })

    it("n'offre plus « Département », colonne supprimée côté serveur", async () => {
      // `PUT /profiles/:userId/administrative` répond depuis le 2026-08-11
      // `400 property department should not exist` : un champ resté à l'écran
      // aurait cassé tout enregistrement dès qu'il était rempli.
      mockFetchProfile.mockResolvedValue(EMPTY_PROFILE)

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByLabelText('Prénom')).toBeDefined()
      })
      expect(screen.queryByLabelText('Département')).toBeNull()
    })

    it("affiche l'adresse e-mail du compte, en lecture, sur son propre profil", async () => {
      // L'e-mail vient de la session (`identity-access-service`), jamais du
      // profil : aucune route ne le modifie, il n'est donc pas saisissable.
      mockFetchProfile.mockResolvedValue(EMPTY_PROFILE)

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Adresse e-mail')).toBeDefined()
      })
      expect(screen.getByText(STUDENT_USER.email)).toBeDefined()
      expect(screen.queryByLabelText('Adresse e-mail')).toBeNull()
    })

    it("n'affiche aucune adresse e-mail sur la fiche d'un tiers", async () => {
      // Le RP consulte l'élève : `GET /profiles/:userId` ne renvoie pas
      // l'e-mail du titulaire, et le catalogue de visibilité ne le connaît pas —
      // l'élève ne pourrait donc pas le masquer. On n'affiche rien.
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER) as never)
      mockFetchProfile.mockResolvedValue(EMPTY_PROFILE)

      renderProfilePage('student-1')

      await waitFor(() => {
        expect(screen.getByRole('tab', { name: 'Profil administratif' })).toBeDefined()
      })
      expect(screen.queryByText('Adresse e-mail')).toBeNull()
      expect(screen.queryByText(RP_USER.email)).toBeNull()
      expect(screen.queryByText(STUDENT_USER.email)).toBeNull()
    })

    it("place l'emplacement de la photo en tête de l'onglet administratif", async () => {
      // La photo n'est plus un champ de texte du formulaire : elle a son propre
      // bloc, avec l'action qui permet d'en poser une.
      mockFetchProfile.mockResolvedValue(EMPTY_PROFILE)

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Photo de profil' })).toBeDefined()
      })
      expect(screen.getByLabelText('Ajouter une photo')).toBeDefined()
      // L'ancien champ « URL de la photo » a disparu : le serveur le refuse.
      expect(screen.queryByPlaceholderText('https://…/ma-photo.jpg')).toBeNull()
    })

    it('propose le formulaire élève vide quand aucun profil pédagogique n’existe', async () => {
      // `pedagogical: null` + `pedagogicalType: null` est un état NORMAL : la
      // forme se déduit du rôle du titulaire, comme le fait déjà l'écran de
      // modification.
      mockFetchProfile.mockResolvedValue(EMPTY_PROFILE)

      renderProfilePage()

      const pedagogiqueTab = await screen.findByRole('tab', { name: 'Profil pédagogique' })
      fireEvent.click(pedagogiqueTab)

      await waitFor(() => {
        expect(screen.getByLabelText('Niveau scolaire')).toBeDefined()
      })
      for (const label of [
        'Niveau scolaire',
        'Établissement',
        'Matières',
        'Objectifs pédagogiques',
        'Difficultés rencontrées',
        'Besoins spécifiques (aménagements)',
        'Contexte familial',
        'Contexte scolaire',
        'Matériel (lieu des cours, équipement)',
      ]) {
        expect(screen.getByLabelText(label)).toBeDefined()
      }
      // L'ancien champ unique a disparu : le serveur répond `400` s'il le reçoit.
      expect(screen.queryByLabelText('Contexte scolaire et familial')).toBeNull()
      expect(screen.queryByText(/ne peut pas être déterminée/i)).toBeNull()
    })

    it('enregistre les champs saisis sur la fiche elle-même', async () => {
      mockFetchProfile.mockResolvedValue(EMPTY_PROFILE)
      mockUpdateAdministrativeProfile.mockResolvedValue({})

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByLabelText('Ville')).toBeDefined()
      })

      await userEvent.type(screen.getByLabelText('Ville'), 'Lyon')
      await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

      await waitFor(() => {
        expect(mockUpdateAdministrativeProfile).toHaveBeenCalledWith('student-1', {
          firstName: 'Marie',
          lastName: 'Dupont',
          city: 'Lyon',
        })
      })
      expect(await screen.findByText('Profil administratif mis à jour')).toBeDefined()
    })

    it("n'affiche aucun bloc pédagogique au parent financeur", async () => {
      // Le parent finance et consulte ; il n'a pas de profil pédagogique, et lui
      // en présenter un vide l'inviterait à remplir ce qui n'existe pas pour lui.
      mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))
      mockFetchProfile.mockResolvedValue({
        ...EMPTY_PROFILE,
        userId: 'parent-1',
        administrative: { firstName: 'Hélène', lastName: 'Dupont' },
      })

      renderProfilePage('parent-1')

      await waitFor(() => {
        expect(screen.getByLabelText('Prénom')).toBeDefined()
      })

      expect(screen.queryByRole('tab', { name: 'Profil pédagogique' })).toBeNull()
      expect(screen.queryByLabelText('Niveau scolaire')).toBeNull()
      expect(screen.queryByText(/ne peut pas être déterminée/i)).toBeNull()
    })
  })

  /**
   * Sans droit d'écriture, les mêmes champs restent listés — mais en lecture, et
   * marqués « Non renseigné ». Un lecteur ne doit jamais croire qu'un champ vide
   * n'existe pas.
   */
  describe('lecture sans droit d’écriture', () => {
    it('liste tous les champs, marqués « Non renseigné », sans zone de saisie', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(PARENT_USER))
      mockFetchProfile.mockResolvedValue({
        userId: 'student-1',
        administrative: { firstName: 'Marie', lastName: 'Dupont' },
        pedagogical: null,
        pedagogicalType: 'student' as const,
      })

      renderProfilePage('student-1')

      await waitFor(() => {
        expect(screen.getByText('Marie')).toBeDefined()
      })

      expect(screen.getByText('Ville')).toBeDefined()
      expect(screen.getByText('Téléphone')).toBeDefined()
      expect(screen.getByText("Centres d'intérêt")).toBeDefined()
      expect(screen.getAllByText('Non renseigné').length).toBeGreaterThanOrEqual(9)

      // Aucun champ n'est saisissable : le parent lit tout, n'écrit rien.
      expect(screen.queryByLabelText('Ville')).toBeNull()
      expect(screen.queryByRole('button', { name: /enregistrer/i })).toBeNull()
      // Et « Non renseigné » ne se confond jamais avec « Non partagé ».
      expect(screen.queryByText('Non partagé')).toBeNull()
    })
  })

  /**
   * Filtrage de visibilité champ par champ (`docs/routes.md` § « Application en
   * lecture », 2026-08-09).
   *
   * Le formateur rattaché subit les réglages de l'élève : les champs masqués sont
   * ABSENTS des blocs et nommés dans `visibility.hiddenFields`. Le titulaire, le
   * parent financeur et les administrateurs reçoivent `isFiltered: false`.
   */
  describe('lecture filtrée', () => {
    const TEACHER_USER = {
      id: 'teacher-1',
      email: 'prof@test.com',
      role: 'formateur' as const,
      validationStatus: 'active' as const,
    }

    /**
     * Réponse telle que la reçoit un formateur rattaché : `phone` et
     * `difficulties` ont été RETIRÉS de leurs blocs — pas mis à `null` — et
     * `city` est présent à `null`, donc simplement non renseigné.
     */
    const FILTERED_PROFILE = {
      userId: 'student-1',
      administrative: { firstName: 'Marie', lastName: 'Dupont', city: null },
      pedagogical: { level: 'Terminale' },
      pedagogicalType: 'student' as const,
      visibility: { isFiltered: true, hiddenFields: ['phone', 'difficulties'] },
    }

    it('signale « Non partagé » sur un champ administratif masqué', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchProfile.mockResolvedValue(FILTERED_PROFILE)

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Marie')).toBeDefined()
      })

      expect(screen.getByText('Téléphone')).toBeDefined()
      expect(screen.getAllByText('Non partagé').length).toBeGreaterThanOrEqual(1)
    })

    it('affiche différemment un champ non renseigné et un champ non partagé', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchProfile.mockResolvedValue(FILTERED_PROFILE)

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Marie')).toBeDefined()
      })

      // Les deux champs sont listés — c'est la mention qui les distingue.
      // `city` est présent à `null` : personne ne l'a rempli.
      expect(screen.getByText('Ville')).toBeDefined()
      expect(screen.getAllByText('Non renseigné').length).toBeGreaterThanOrEqual(1)
      // `phone` est absent et déclaré masqué : l'élève a choisi de ne pas le montrer.
      expect(screen.getByText('Téléphone')).toBeDefined()
      expect(screen.getAllByText('Non partagé').length).toBeGreaterThanOrEqual(1)
    })

    it('reste en lecture seule pour un lecteur filtré', async () => {
      // Un formateur ne modifie pas le profil de son élève ; et un formulaire
      // bâti sur un bloc amputé proposerait de réécrire ce qu'il ne voit pas.
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchProfile.mockResolvedValue(FILTERED_PROFILE)

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Marie')).toBeDefined()
      })

      expect(screen.queryByLabelText('Ville')).toBeNull()
      expect(screen.queryByRole('button', { name: /enregistrer/i })).toBeNull()
    })

    it('explique le filtrage une seule fois, en tête de fiche', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchProfile.mockResolvedValue(FILTERED_PROFILE)

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Vous consultez une fiche partielle')).toBeDefined()
      })

      expect(screen.getAllByText('Vous consultez une fiche partielle')).toHaveLength(1)
    })

    it('signale « Non partagé » sur un champ pédagogique masqué', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchProfile.mockResolvedValue(FILTERED_PROFILE)

      renderProfilePage()

      const pedagogiqueTab = await screen.findByRole('tab', { name: 'Profil pédagogique' })
      fireEvent.click(pedagogiqueTab)

      await waitFor(() => {
        expect(screen.getByText('Terminale')).toBeDefined()
      })

      expect(screen.getByText('Difficultés rencontrées')).toBeDefined()
      expect(screen.getAllByText('Non partagé').length).toBeGreaterThanOrEqual(1)
    })

    it("n'annonce aucun filtrage au titulaire (isFiltered: false)", async () => {
      mockFetchProfile.mockResolvedValue({
        ...SAMPLE_PROFILE,
        visibility: { isFiltered: false, hiddenFields: [] },
      })

      renderProfilePage()

      await waitFor(() => {
        expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Marie')
      })

      expect(screen.queryByText('Vous consultez une fiche partielle')).toBeNull()
      expect(screen.queryByText('Non partagé')).toBeNull()
    })

    it("n'annonce aucun filtrage quand la réponse n'a pas de bloc `visibility`", async () => {
      // Réponse tronquée ou serveur antérieur : ne rien annoncer plutôt
      // qu'annoncer un filtrage inexistant.
      mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

      renderProfilePage()

      await waitFor(() => {
        expect((screen.getByLabelText('Prénom') as HTMLInputElement).value).toBe('Marie')
      })

      expect(screen.queryByText('Vous consultez une fiche partielle')).toBeNull()
      expect(screen.queryByText('Non partagé')).toBeNull()
    })
  })

  it('shows "Profil introuvable" for 404 error', async () => {
    mockFetchProfile.mockRejectedValue({ response: { status: 404 } })

    renderProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Profil introuvable')).toBeDefined()
    })
  })

  it('shows "Accès refusé" for 403 error', async () => {
    mockFetchProfile.mockRejectedValue({ response: { status: 403 } })

    renderProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Accès refusé')).toBeDefined()
    })
  })

  it('shows edit button when viewing own profile as élève', async () => {
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

    renderProfilePage('student-1')

    await waitFor(() => {
      expect(screen.getByRole('link', { name: /modifier/i })).toBeDefined()
    })
  })

  it('does NOT show internal notes section for élève role', async () => {
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

    renderProfilePage()

    await waitFor(() => {
      expect(screen.queryByText('Notes internes')).toBeNull()
    })
  })

  it('shows internal notes section for RP role', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

    const internalNotes = [
      { id: 'note-1', authorId: 'rp-1', content: 'Élève en difficulté', createdAt: new Date().toISOString() },
    ]
    mockFetchInternalNotes.mockResolvedValue(internalNotes)

    renderProfilePage()

    await waitFor(() => {
      expect(screen.getByText('Notes internes')).toBeDefined()
      expect(screen.getByText('Élève en difficulté')).toBeDefined()
    })
  })

  it('allows RP to add an internal note via createInternalNote', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
    mockFetchInternalNotes.mockResolvedValue([])

    const newNote = {
      id: 'note-new',
      authorId: 'rp-1',
      content: 'Nouveau suivi nécessaire',
      createdAt: new Date().toISOString(),
    }
    mockCreateInternalNote.mockResolvedValue(newNote)

    renderProfilePage()

    await waitFor(() => {
      screen.getByText('Ajouter une note')
    })

    await userEvent.click(screen.getByText('Ajouter une note'))

    await userEvent.type(
      screen.getByPlaceholderText(/note interne/i),
      'Nouveau suivi nécessaire',
    )

    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    await waitFor(() => {
      expect(mockCreateInternalNote).toHaveBeenCalledWith('student-1', 'Nouveau suivi nécessaire')
    })
  })

  it('shows the new note in the list after adding it', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
    mockFetchInternalNotes.mockResolvedValue([])

    const newNote = {
      id: 'note-new',
      authorId: 'rp-1',
      content: 'Suivi trimestriel',
      createdAt: new Date().toISOString(),
    }
    mockCreateInternalNote.mockResolvedValue(newNote)

    renderProfilePage()

    await waitFor(() => {
      screen.getByText('Ajouter une note')
    })

    await userEvent.click(screen.getByText('Ajouter une note'))
    await userEvent.type(screen.getByPlaceholderText(/note interne/i), 'Suivi trimestriel')
    await userEvent.click(screen.getByRole('button', { name: /ajouter$/i }))

    await waitFor(() => {
      expect(screen.getByText('Suivi trimestriel')).toBeDefined()
    })
  })

  /**
   * Fin d'une relation élève ↔ formateur (arbitrage du 2026-08-12, « Fin d'une
   * relation élève↔formateur ») : le point d'action est la fiche de l'élève,
   * réservé au RP.
   */
  describe('formateurs liés — mettre fin à une relation (RP)', () => {
    const LINKED_TEACHER_RELATION = {
      id: 'relation-1',
      teacherId: 'teacher-1',
      studentId: 'student-1',
      isPrincipalTeacher: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      endedAt: null,
      teacherName: { firstName: 'Paul', lastName: 'Martin' },
    }

    it('affiche le nom du formateur, jamais son identifiant technique', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
      mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
      mockFetchTeacherStudentRelations.mockResolvedValue([LINKED_TEACHER_RELATION])

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Formateurs liés')).toBeDefined()
      })

      expect(screen.getByText('Paul Martin')).toBeDefined()
      expect(screen.queryByText('teacher-1')).toBeNull()
    })

    it('propose « Mettre fin » au RP, jamais au formateur', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
      mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
      mockFetchTeacherStudentRelations.mockResolvedValue([LINKED_TEACHER_RELATION])

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Paul Martin')).toBeDefined()
      })
      expect(screen.getByRole('button', { name: 'Mettre fin Paul Martin' })).toBeDefined()
    })

    it("ne propose pas « Mettre fin » à un formateur consultant la fiche", async () => {
      const TEACHER_USER = {
        id: 'teacher-1',
        email: 'prof@test.com',
        role: 'formateur' as const,
        validationStatus: 'active' as const,
      }
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
      mockFetchTeacherStudentRelations.mockResolvedValue([LINKED_TEACHER_RELATION])

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Paul Martin')).toBeDefined()
      })
      expect(screen.queryByRole('button', { name: 'Mettre fin Paul Martin' })).toBeNull()
    })

    it('demande confirmation, appelle le DELETE puis retire le formateur de la liste', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
      mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
      mockFetchTeacherStudentRelations.mockResolvedValue([LINKED_TEACHER_RELATION])
      mockUnlinkTeacherStudentRelation.mockResolvedValue({
        ...LINKED_TEACHER_RELATION,
        endedAt: '2026-08-13T10:00:00.000Z',
        endedBy: 'rp-1',
        endReason: null,
      })

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Paul Martin')).toBeDefined()
      })

      await userEvent.click(screen.getByRole('button', { name: 'Mettre fin Paul Martin' }))

      // La boîte de confirmation nomme le formateur, jamais un UUID.
      const dialog = screen.getByRole('dialog')
      expect(dialog.textContent).toContain('Mettre fin à la relation avec Paul Martin ?')

      await userEvent.click(within(dialog).getByRole('button', { name: 'Mettre fin' }))

      await waitFor(() => {
        expect(mockUnlinkTeacherStudentRelation).toHaveBeenCalledWith(
          'teacher-1',
          'student-1',
          undefined,
        )
      })

      // La réponse du serveur fait foi : le formateur quitte la liste sans
      // nouvelle requête de lecture (règle du 2026-08-10).
      await waitFor(() => {
        expect(screen.queryByText('Paul Martin')).toBeNull()
      })
      expect(mockFetchTeacherStudentRelations).toHaveBeenCalledTimes(1)
    })

    it('transmet le motif saisi, une fois trimmé', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
      mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
      mockFetchTeacherStudentRelations.mockResolvedValue([LINKED_TEACHER_RELATION])
      mockUnlinkTeacherStudentRelation.mockResolvedValue({
        ...LINKED_TEACHER_RELATION,
        endedAt: '2026-08-13T10:00:00.000Z',
        endedBy: 'rp-1',
        endReason: 'Formateur indisponible',
      })

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Paul Martin')).toBeDefined()
      })

      await userEvent.click(screen.getByRole('button', { name: 'Mettre fin Paul Martin' }))
      await userEvent.type(
        screen.getByLabelText('Motif (optionnel)'),
        '  Formateur indisponible  ',
      )
      const dialog = screen.getByRole('dialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Mettre fin' }))

      await waitFor(() => {
        expect(mockUnlinkTeacherStudentRelation).toHaveBeenCalledWith(
          'teacher-1',
          'student-1',
          'Formateur indisponible',
        )
      })
    })

    it('affiche le refus et garde le formateur dans la liste si le serveur refuse', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
      mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
      mockFetchTeacherStudentRelations.mockResolvedValue([LINKED_TEACHER_RELATION])
      mockUnlinkTeacherStudentRelation.mockRejectedValue({ response: { status: 404 } })

      renderProfilePage()

      await waitFor(() => {
        expect(screen.getByText('Paul Martin')).toBeDefined()
      })

      await userEvent.click(screen.getByRole('button', { name: 'Mettre fin Paul Martin' }))
      const dialog = screen.getByRole('dialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Mettre fin' }))

      await waitFor(() => {
        expect(
          screen.getByText('Aucune relation trouvée entre cet élève et ce formateur. Rechargez la page.'),
        ).toBeDefined()
      })

      // La boîte reste ouverte, le formateur reste affiché : rien n'a été perdu.
      expect(screen.getByText('Paul Martin')).toBeDefined()
    })
  })

  /**
   * Onglet « Confidentialité » (décision du 2026-08-18) : les consentements
   * RGPD/CGU/marketing apparaissent désormais en tête de l'onglet, au-dessus de
   * la tuile de réglages de visibilité champ par champ — renommée « Détails ».
   */
  describe('onglet Confidentialité', () => {
    it('affiche les consentements puis la tuile « Détails », sur son propre profil', async () => {
      mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)
      mockFetchConsents.mockResolvedValue([
        {
          consentType: 'rgpd',
          status: 'granted',
          isGranted: true,
          isMandatory: true,
          isWithdrawable: false,
          version: '1.0',
          grantedAt: '2026-01-05T10:00:00.000Z',
          withdrawnAt: null,
          updatedAt: '2026-01-05T10:00:00.000Z',
        },
      ])

      renderProfilePage()

      const confidentialiteTab = await screen.findByRole('tab', { name: 'Confidentialité' })
      fireEvent.click(confidentialiteTab)

      await waitFor(() => {
        expect(screen.getByText('Consentements RGPD / CGU')).toBeDefined()
      })
      expect(screen.getByText('Protection des données personnelles (RGPD)')).toBeDefined()

      // L'ancienne tuile « Confidentialité » est renommée « Détails » et
      // renvoie toujours vers l'écran de visibilité champ par champ.
      expect(screen.getByText('Détails')).toBeDefined()
      expect(screen.queryByRole('heading', { name: 'Confidentialité' })).toBeNull()
      const detailsLink = screen.getByRole('link', { name: /gérer/i })
      expect(detailsLink.getAttribute('href')).toBe('/profiles/student-1/visibility')
    })

    it("n'affiche pas les consentements d'un tiers : masqués quand un RP consulte un autre profil", async () => {
      // `GET /consents` ne renvoie que les consentements de l'appelant authentifié
      // (ici le RP lui-même) — jamais ceux de l'élève consulté. Les afficher serait
      // montrer au RP ses propres consentements en les faisant passer pour ceux
      // de l'élève.
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
      mockFetchProfile.mockResolvedValue(SAMPLE_PROFILE)

      renderProfilePage('student-1')

      const confidentialiteTab = await screen.findByRole('tab', { name: 'Confidentialité' })
      fireEvent.click(confidentialiteTab)

      await waitFor(() => {
        expect(screen.getByText('Détails')).toBeDefined()
      })
      expect(screen.queryByText('Consentements RGPD / CGU')).toBeNull()
      expect(mockFetchConsents).not.toHaveBeenCalled()
    })
  })
})
