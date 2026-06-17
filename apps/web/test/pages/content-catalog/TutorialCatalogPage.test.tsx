/**
 * Tests pour TutorialCatalogPage (Phase 12)
 *
 * Couvre :
 * - L'élève voit les tutoriels publiés
 * - L'élève ne voit pas le bouton "Nouveau tutoriel"
 * - Le formateur voit le bouton "Nouveau tutoriel"
 * - Le formateur peut créer un tutoriel (sans solution — tutoriels n'en nécessitent pas)
 * - Le formateur peut créer un tutoriel sans URL vidéo
 * - Sélectionner un tutoriel affiche son détail et ses commentaires
 * - Le lien vidéo s'affiche si une URL est fournie
 * - Le commentaire inline fonctionne sur le tutoriel sélectionné
 * - État vide et état d'erreur de chargement
 * - Badge "En attente" pour les tutoriels pending_validation
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/contentCatalog')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchTutorials, createTutorial, createContentComment } from '../../../src/api/contentCatalog'
import TutorialCatalogPage from '../../../src/pages/TutorialCatalogPage'
import type { Tutorial, ContentComment } from '../../../src/api/contentCatalog'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchTutorials = vi.mocked(fetchTutorials)
const mockCreateTutorial = vi.mocked(createTutorial)
const mockCreateContentComment = vi.mocked(createContentComment)

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

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
    isInternalRole: vi.fn(() =>
      (['responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier'] as string[]).includes(userObj.role),
    ),
  }
}

// ─── Fixtures tutoriels ───────────────────────────────────────────────────────

const PUBLISHED_TUTORIAL: Tutorial = {
  id: 'tuto-1',
  title: 'Introduction aux intégrales',
  description: 'Comprendre les bases des intégrales définies',
  subject: 'Mathématiques',
  level: 'Terminale',
  videoUrl: 'https://video.example.com/integrales',
  status: 'published',
  authorId: 'teacher-1',
  createdAt: '2026-06-15T08:00:00Z',
}

const TUTORIAL_NO_VIDEO: Tutorial = {
  id: 'tuto-2',
  title: 'Calcul littéral avancé',
  description: 'Techniques de calcul littéral',
  subject: 'Mathématiques',
  level: 'Première',
  status: 'published',
  authorId: 'teacher-1',
  createdAt: '2026-06-15T09:00:00Z',
}

const CREATED_TUTORIAL: Tutorial = {
  id: 'tuto-new',
  title: 'Nouveau tutoriel',
  description: 'Description du nouveau tutoriel',
  subject: 'Mathématiques',
  level: 'Terminale',
  videoUrl: 'https://video.example.com/nouveau',
  status: 'pending_validation',
  authorId: 'teacher-1',
  createdAt: '2026-06-17T10:00:00Z',
}

const MOCK_COMMENT: ContentComment = {
  id: 'comment-1',
  contentId: 'tuto-1',
  authorId: 'student-1',
  content: 'Très clair, merci !',
  createdAt: '2026-06-17T11:00:00Z',
}

// ─── Helper de rendu ──────────────────────────────────────────────────────────

function renderPage() {
  return render(
    <MemoryRouter>
      <TutorialCatalogPage />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchTutorials.mockResolvedValue([])
  mockCreateContentComment.mockResolvedValue(MOCK_COMMENT)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TutorialCatalogPage', () => {
  describe('Chargement et états', () => {
    it('affiche l\'état de chargement initialement', () => {
      mockFetchTutorials.mockReturnValue(new Promise(() => {}))
      renderPage()
      expect(screen.getByText(/Chargement des tutoriels/)).toBeDefined()
    })

    it('affiche "Aucun tutoriel disponible" quand la liste est vide', async () => {
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/Aucun tutoriel disponible/)).toBeDefined()
      })
    })

    it('affiche une erreur si le chargement échoue', async () => {
      mockFetchTutorials.mockRejectedValue(new Error('Server error'))
      renderPage()
      await waitFor(() => {
        expect(screen.getByText(/Impossible de charger les tutoriels/)).toBeDefined()
      })
    })
  })

  describe('Affichage liste', () => {
    it('l\'élève voit les tutoriels publiés', async () => {
      mockFetchTutorials.mockResolvedValue([PUBLISHED_TUTORIAL])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Introduction aux intégrales')).toBeDefined()
      })
    })

    it('affiche le sujet et le niveau du tutoriel', async () => {
      mockFetchTutorials.mockResolvedValue([PUBLISHED_TUTORIAL])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Mathématiques')).toBeDefined()
        expect(screen.getByText('Terminale')).toBeDefined()
      })
    })

    it('affiche le badge "En attente" pour un tutoriel pending_validation', async () => {
      const pendingTutorial: Tutorial = {
        ...PUBLISHED_TUTORIAL,
        id: 'tuto-pending',
        status: 'pending_validation',
      }
      mockFetchTutorials.mockResolvedValue([pendingTutorial])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('En attente')).toBeDefined()
      })
    })

    it('affiche plusieurs tutoriels', async () => {
      mockFetchTutorials.mockResolvedValue([PUBLISHED_TUTORIAL, TUTORIAL_NO_VIDEO])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Introduction aux intégrales')).toBeDefined()
        expect(screen.getByText('Calcul littéral avancé')).toBeDefined()
      })
    })
  })

  describe('Sélection d\'un tutoriel', () => {
    it('affiche l\'invite de sélection quand aucun tutoriel n\'est sélectionné', async () => {
      mockFetchTutorials.mockResolvedValue([PUBLISHED_TUTORIAL])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText(/Sélectionnez un tutoriel pour afficher son contenu/)).toBeDefined()
      })
    })

    it('affiche le détail d\'un tutoriel après sélection', async () => {
      mockFetchTutorials.mockResolvedValue([PUBLISHED_TUTORIAL])
      renderPage()

      await waitFor(() => {
        screen.getByText('Introduction aux intégrales')
      })

      // Cliquer sur le tutoriel dans la liste
      await userEvent.click(screen.getAllByText('Introduction aux intégrales')[0])

      await waitFor(() => {
        // La description apparaît à la fois dans la liste (truncated) et dans le détail
        // On vérifie qu'au moins un élément avec ce texte est présent
        const descriptionElements = screen.getAllByText('Comprendre les bases des intégrales définies')
        expect(descriptionElements.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('affiche le lien vidéo si une URL est fournie', async () => {
      mockFetchTutorials.mockResolvedValue([PUBLISHED_TUTORIAL])
      renderPage()

      await waitFor(() => {
        screen.getByText('Introduction aux intégrales')
      })

      await userEvent.click(screen.getAllByText('Introduction aux intégrales')[0])

      await waitFor(() => {
        const link = screen.getByRole('link', { name: /regarder le tutoriel/i })
        expect(link).toBeDefined()
        expect((link as HTMLAnchorElement).href).toContain('https://video.example.com/integrales')
      })
    })

    it('n\'affiche pas de lien vidéo si l\'URL est absente', async () => {
      mockFetchTutorials.mockResolvedValue([TUTORIAL_NO_VIDEO])
      renderPage()

      await waitFor(() => {
        screen.getByText('Calcul littéral avancé')
      })

      await userEvent.click(screen.getAllByText('Calcul littéral avancé')[0])

      await waitFor(() => {
        expect(screen.queryByRole('link', { name: /regarder le tutoriel/i })).toBeNull()
      })
    })

    it('affiche la section commentaires après sélection', async () => {
      mockFetchTutorials.mockResolvedValue([PUBLISHED_TUTORIAL])
      renderPage()

      await waitFor(() => {
        screen.getByText('Introduction aux intégrales')
      })

      await userEvent.click(screen.getAllByText('Introduction aux intégrales')[0])

      await waitFor(() => {
        expect(screen.getByText(/Commentaires/)).toBeDefined()
      })
    })

    it('l\'élève peut commenter un tutoriel sélectionné', async () => {
      mockFetchTutorials.mockResolvedValue([PUBLISHED_TUTORIAL])
      renderPage()

      await waitFor(() => {
        screen.getByText('Introduction aux intégrales')
      })

      await userEvent.click(screen.getAllByText('Introduction aux intégrales')[0])

      await waitFor(() => {
        screen.getByLabelText(/Ajouter un commentaire/)
      })

      await userEvent.type(screen.getByLabelText(/Ajouter un commentaire/), 'Très clair, merci !')
      await userEvent.click(screen.getByRole('button', { name: /publier/i }))

      await waitFor(() => {
        expect(screen.getByText('Très clair, merci !')).toBeDefined()
      })

      expect(mockCreateContentComment).toHaveBeenCalledWith('tuto-1', {
        content: 'Très clair, merci !',
      })
    })
  })

  describe('Contrôle d\'accès à la création', () => {
    it('l\'élève ne voit pas le bouton "Nouveau tutoriel"', async () => {
      mockFetchTutorials.mockResolvedValue([PUBLISHED_TUTORIAL])
      renderPage()

      await waitFor(() => {
        expect(screen.getByText('Introduction aux intégrales')).toBeDefined()
      })

      expect(screen.queryByRole('button', { name: /nouveau tutoriel/i })).toBeNull()
    })

    it('le formateur voit le bouton "Nouveau tutoriel"', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchTutorials.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /nouveau tutoriel/i })).toBeDefined()
      })
    })

    it('le RP voit le bouton "Nouveau tutoriel"', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
      mockFetchTutorials.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /nouveau tutoriel/i })).toBeDefined()
      })
    })
  })

  describe('Formulaire de création', () => {
    it('le formateur peut ouvrir le formulaire de création', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchTutorials.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouveau tutoriel/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouveau tutoriel/i }))

      expect(screen.getByText('Créer un tutoriel')).toBeDefined()
    })

    it('le formateur crée un tutoriel avec URL vidéo', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchTutorials.mockResolvedValue([])
      mockCreateTutorial.mockResolvedValue(CREATED_TUTORIAL)
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouveau tutoriel/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouveau tutoriel/i }))

      await userEvent.type(screen.getByLabelText(/titre/i), 'Nouveau tutoriel')
      await userEvent.type(screen.getByLabelText(/matière/i), 'Mathématiques')
      await userEvent.type(screen.getByLabelText(/niveau/i), 'Terminale')
      await userEvent.type(screen.getByLabelText(/description/i), 'Description du nouveau tutoriel')
      await userEvent.type(screen.getByLabelText(/url vidéo/i), 'https://video.example.com/nouveau')

      await userEvent.click(screen.getByRole('button', { name: /créer le tutoriel/i }))

      await waitFor(() => {
        // Après création, le titre apparaît dans la liste ("Nouveau tutoriel" dans un <p>)
        // et aussi dans le bouton "Nouveau tutoriel" — utiliser getAllByText
        const matches = screen.getAllByText('Nouveau tutoriel')
        expect(matches.length).toBeGreaterThanOrEqual(1)
      })

      expect(mockCreateTutorial).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Nouveau tutoriel',
          videoUrl: 'https://video.example.com/nouveau',
        }),
      )
    })

    it('le formateur crée un tutoriel sans URL vidéo (optionnel)', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchTutorials.mockResolvedValue([])
      mockCreateTutorial.mockResolvedValue({ ...CREATED_TUTORIAL, videoUrl: undefined })
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouveau tutoriel/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouveau tutoriel/i }))

      await userEvent.type(screen.getByLabelText(/titre/i), 'Nouveau tutoriel')
      await userEvent.type(screen.getByLabelText(/matière/i), 'Mathématiques')
      await userEvent.type(screen.getByLabelText(/niveau/i), 'Terminale')
      await userEvent.type(screen.getByLabelText(/description/i), 'Description')
      // Ne pas renseigner l'URL vidéo

      await userEvent.click(screen.getByRole('button', { name: /créer le tutoriel/i }))

      await waitFor(() => {
        // Le titre apparaît dans la liste après création
        const matches = screen.getAllByText('Nouveau tutoriel')
        expect(matches.length).toBeGreaterThanOrEqual(1)
      })

      expect(mockCreateTutorial).toHaveBeenCalledWith(
        expect.objectContaining({ videoUrl: undefined }),
      )
    })

    it('affiche une erreur 403 si le rôle n\'est pas autorisé', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchTutorials.mockResolvedValue([])
      mockCreateTutorial.mockRejectedValue({ response: { status: 403 } })
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouveau tutoriel/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouveau tutoriel/i }))

      await userEvent.type(screen.getByLabelText(/titre/i), 'Test')
      await userEvent.type(screen.getByLabelText(/matière/i), 'Maths')
      await userEvent.type(screen.getByLabelText(/niveau/i), 'Terminale')
      await userEvent.type(screen.getByLabelText(/description/i), 'Desc')

      await userEvent.click(screen.getByRole('button', { name: /créer le tutoriel/i }))

      await waitFor(() => {
        expect(screen.getByText(/Vous n'êtes pas autorisé à créer un tutoriel/)).toBeDefined()
      })
    })

    it('le bouton Annuler ferme le formulaire sans appeler l\'API', async () => {
      mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
      mockFetchTutorials.mockResolvedValue([])
      renderPage()

      await waitFor(() => {
        screen.getByRole('button', { name: /nouveau tutoriel/i })
      })

      await userEvent.click(screen.getByRole('button', { name: /nouveau tutoriel/i }))
      expect(screen.getByText('Créer un tutoriel')).toBeDefined()

      await userEvent.click(screen.getByRole('button', { name: /annuler/i }))

      expect(screen.queryByText('Créer un tutoriel')).toBeNull()
      expect(mockCreateTutorial).not.toHaveBeenCalled()
    })
  })
})
