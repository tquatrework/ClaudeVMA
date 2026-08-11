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
import ProfileStatisticsPanel from '../../../src/components/profile/ProfileStatisticsPanel'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/profile')

import { useAuth } from '../../../src/hooks/useAuth'
import { fetchProfileStatistics } from '../../../src/api/profile'

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
  /**
   * Le garde de rôle côté client a été retiré le 2026-08-11 : le droit vient de la
   * relation métier et appartient au serveur. Le garde empêchait précisément la
   * lecture que l'arbitrage ouvre — un élève consultant SON formateur voyait un
   * panneau vide, avant même la moindre requête.
   */
  it("interroge le serveur quand un élève consulte les statistiques de son formateur", async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchProfileStatistics.mockResolvedValue({
      userId: 'teacher-1',
      profileType: 'teacher' as const,
      statistics: { subjects: ['Mathématiques'] },
      visibility: { isFiltered: true, hiddenFields: ['levels'] },
    })

    render(<ProfileStatisticsPanel userId="teacher-1" />)

    await waitFor(() => {
      expect(mockFetchProfileStatistics).toHaveBeenCalledWith('teacher-1')
    })
    expect(screen.getByText('Mathématiques')).toBeDefined()
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

  it('marque « Non renseigné » un champ présent valant `null`', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchProfileStatistics.mockResolvedValue(UNFILTERED_RESPONSE)

    render(<ProfileStatisticsPanel userId="student-1" />)

    await waitFor(() => {
      expect(screen.getByText('Terminale')).toBeDefined()
    })

    // `goals: null` → la ligne existe, portant « Non renseigné », et surtout
    // jamais « Non partagé » : personne ne l'a masqué, personne ne l'a rempli.
    expect(screen.getByText('Objectifs pédagogiques')).toBeDefined()
    expect(screen.getByText('Non renseigné')).toBeDefined()
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
  it('traite un 404 comme un état vide, jamais comme une erreur', async () => {
    // Refus par absence de relation et absence de statistiques répondent le même
    // 404, avec le même message : les deux sont volontairement indiscernables.
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    mockFetchProfileStatistics.mockRejectedValue({ response: { status: 404 } })

    render(<ProfileStatisticsPanel userId="teacher-2" />)

    await waitFor(() => {
      expect(screen.getByText('Aucune statistique disponible')).toBeDefined()
    })
    expect(screen.queryByText('Statistiques non disponibles pour le moment')).toBeNull()
  })

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
