/**
 * Tests de ProfileStatisticsPanel (`GET /profiles/:userId/statistics`).
 *
 * Deux contrats vérifiés ici :
 *
 * 1. **L'enveloppe.** La route renvoie `{userId, profileType, statistics, visibility}` :
 *    les données sont dans `statistics`, pas à la racine. Les fixtures de ce
 *    fichier posaient auparavant des indicateurs inventés (`totalSessionsAttended`…)
 *    à la racine — l'écran restait vide en réalité tandis que les tests passaient.
 *    En phase 1, `statistics` porte les champs du profil pédagogique.
 * 2. **Le filtrage.** Cette route applique les mêmes réglages de visibilité que
 *    le bloc `pedagogical` : un champ non partagé est ABSENT de `statistics` et
 *    nommé dans `visibility.hiddenFields`. Sans quoi elle serait le contournement
 *    exact du filtrage.
 */

import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ProfileStatisticsPanel from '../../src/pages/ProfileStatisticsPanel'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchProfileStatistics } from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchProfileStatistics = vi.mocked(fetchProfileStatistics)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'prof@test.com',
  role: 'formateur' as const,
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

/** Lecture non filtrée — titulaire, parent financeur rattaché, administrateurs. */
const UNFILTERED_RESPONSE = {
  userId: 'student-1',
  profileType: 'student' as const,
  statistics: {
    level: 'Terminale',
    subjects: ['Mathématiques', 'Physique'],
    difficulties: 'Les suites numériques',
    goals: null,
  },
  visibility: { isFiltered: false, hiddenFields: [] },
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

describe('ProfileStatisticsPanel — accès', () => {
  it('does not render for a student viewing another student profile', () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    const { container } = render(<ProfileStatisticsPanel userId="student-2" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders for a student viewing their own profile', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchProfileStatistics.mockResolvedValue(UNFILTERED_RESPONSE)

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Statistiques pédagogiques')).toBeDefined()
    })
  })

  it('fetches stats via fetchProfileStatistics(userId)', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfileStatistics.mockResolvedValue(UNFILTERED_RESPONSE)

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(mockFetchProfileStatistics).toHaveBeenCalledWith('student-1')
    })
  })
})

describe('ProfileStatisticsPanel — lecture non filtrée', () => {
  it('lit les données dans `statistics`, pas à la racine de la réponse', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfileStatistics.mockResolvedValue(UNFILTERED_RESPONSE)

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Terminale')).toBeDefined()
    })

    expect(screen.getByText('Mathématiques, Physique')).toBeDefined()
    expect(screen.getByText('Les suites numériques')).toBeDefined()
  })

  it('emploie les libellés français du point unique de correspondance', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfileStatistics.mockResolvedValue(UNFILTERED_RESPONSE)

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Niveau scolaire')).toBeDefined()
    })

    expect(screen.getByText('Matières')).toBeDefined()
    expect(screen.queryByText('Level')).toBeNull()
  })

  it('ne liste pas un champ présent valant `null`', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfileStatistics.mockResolvedValue(UNFILTERED_RESPONSE)

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Terminale')).toBeDefined()
    })

    // `goals: null` → non renseigné, donc pas de ligne, et surtout pas « Non partagé ».
    expect(screen.queryByText('Objectifs pédagogiques')).toBeNull()
    expect(screen.queryByText('Non partagé')).toBeNull()
  })
})

describe('ProfileStatisticsPanel — lecture filtrée', () => {
  /** Réponse reçue par un formateur rattaché : `level` a été retiré. */
  const FILTERED_RESPONSE = {
    userId: 'student-1',
    profileType: 'student' as const,
    statistics: { subjects: ['Mathématiques'] },
    visibility: { isFiltered: true, hiddenFields: ['level'] },
  }

  it('signale « Non partagé » plutôt que de faire disparaître le champ', async () => {
    // Sans cette mention, la route deviendrait un moyen discret de croire que
    // l'élève n'a pas de niveau renseigné.
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchProfileStatistics.mockResolvedValue(FILTERED_RESPONSE)

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Niveau scolaire')).toBeDefined()
    })

    expect(screen.getByText('Non partagé')).toBeDefined()
    expect(screen.getByText('Mathématiques')).toBeDefined()
  })

  it("n'affiche pas « aucune statistique » quand tout est masqué", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))
    mockFetchProfileStatistics.mockResolvedValue({
      userId: 'student-1',
      profileType: 'student' as const,
      statistics: {},
      visibility: { isFiltered: true, hiddenFields: ['level', 'subjects'] },
    })

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getAllByText('Non partagé')).toHaveLength(2)
    })

    expect(screen.queryByText('Aucune statistique disponible')).toBeNull()
  })
})

describe('ProfileStatisticsPanel — cas d’erreur et cas vides', () => {
  it('shows "non disponible" message on fetch error', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfileStatistics.mockRejectedValue({ response: { status: 500 } })

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Statistiques non disponibles pour le moment')).toBeDefined()
    })
  })

  it('shows empty message when the envelope carries no statistics', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfileStatistics.mockResolvedValue({})

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Aucune statistique disponible')).toBeDefined()
    })
  })

  it('shows empty message when statistics is an empty object', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfileStatistics.mockResolvedValue({
      userId: 'student-1',
      statistics: {},
      visibility: { isFiltered: false, hiddenFields: [] },
    })

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Aucune statistique disponible')).toBeDefined()
    })
  })
})
