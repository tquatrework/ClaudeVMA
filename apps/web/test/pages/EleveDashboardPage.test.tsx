/**
 * Tests pour EleveDashboardPage (dashboard-notification-service / calendar-service /
 * profile-service / communication-service)
 *
 * Couvre :
 * - Chargement puis affichage du prochain cours
 * - État vide (aucun cours à venir, aucun professeur assigné → invite à demander un professeur)
 * - Professeur assigné, résolu depuis la relation élève↔formateur (profile-service),
 *   pas depuis les contacts de communication-service
 * - Une fois un professeur assigné : bouton « Demander un professeur » absent, bouton
 *   « Changer de professeur » présent, et tuile « Prochain cours » vide avec bouton
 *   désactivé plutôt qu'une invite à demander un professeur
 * - Notifications affichées via ActivityFeed
 */

import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import EleveDashboardPage from '../../src/pages/EleveDashboardPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/calendar')
vi.mock('../../src/api/dashboardNotifications')
vi.mock('../../src/api/communication')
vi.mock('../../src/api/relations')
vi.mock('../../src/api/profile')

import { useAuth } from '../../src/hooks/useAuth'
import { fetchUserEvents } from '../../src/api/calendar'
import { fetchNotifications } from '../../src/api/dashboardNotifications'
import { fetchContacts } from '../../src/api/communication'
import { fetchTeacherStudentRelations } from '../../src/api/relations'
import { fetchProfileAvatarBlob } from '../../src/api/profile'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchUserEvents = vi.mocked(fetchUserEvents)
const mockFetchNotifications = vi.mocked(fetchNotifications)
const mockFetchContacts = vi.mocked(fetchContacts)
const mockFetchTeacherStudentRelations = vi.mocked(fetchTeacherStudentRelations)
const mockFetchProfileAvatarBlob = vi.mocked(fetchProfileAvatarBlob)

const STUDENT_USER = {
  id: 'student-1',
  loginIdentifier: 'eleve1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock() {
  return {
    user: STUDENT_USER,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn(() => true),
    isInternalRole: vi.fn(() => false),
  }
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <EleveDashboardPage />
    </MemoryRouter>,
  )
}

const FUTURE_ISO_1 = new Date(Date.now() + 86400000).toISOString()
const FUTURE_ISO_2 = new Date(Date.now() + 172800000).toISOString()

/** 404 : pas de photo, ou photo masquée pour ce lecteur — jamais une erreur affichée. */
function notFoundError() {
  return { response: { status: 404 } }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchNotifications.mockResolvedValue([])
  mockFetchContacts.mockResolvedValue([])
  mockFetchUserEvents.mockResolvedValue([])
  mockFetchTeacherStudentRelations.mockResolvedValue([])
  mockFetchProfileAvatarBlob.mockRejectedValue(notFoundError())
})

describe('EleveDashboardPage — prochain cours', () => {
  it('affiche le prochain cours après chargement', async () => {
    mockFetchUserEvents.mockResolvedValue([
      { id: 'evt-1', title: 'Séance d\'algèbre', startAt: FUTURE_ISO_1, endAt: FUTURE_ISO_2 },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Séance d\'algèbre')).toBeDefined()
    })

    expect(mockFetchUserEvents).toHaveBeenCalledWith('student-1')
  })

  it('affiche un état vide invitant à demander un professeur quand aucun cours n\'est prévu et aucun professeur n\'est assigné', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Aucun cours à venir')).toBeDefined()
    })
    // Deux occurrences : la tuile « Mon professeur » et la tuile « Prochain cours ».
    expect(screen.getAllByText('Demander un professeur').length).toBe(2)
  })
})

describe('EleveDashboardPage — professeur assigné', () => {
  it('affiche le professeur résolu depuis la relation élève↔formateur de profile-service', async () => {
    mockFetchTeacherStudentRelations.mockResolvedValue([
      {
        teacherId: 'teacher-1',
        studentId: 'student-1',
        isPrincipalTeacher: true,
        teacherName: { firstName: 'Marie', lastName: 'Curie' },
      },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(mockFetchTeacherStudentRelations).toHaveBeenCalledWith('student-1')
    })
    await waitFor(() => {
      expect(screen.getAllByText('Marie Curie').length).toBeGreaterThan(0)
    })

    // Source des contacts non consultée pour déterminer le professeur assigné.
    expect(mockFetchContacts).toHaveBeenCalled()
    expect(screen.queryByText('Vous n\'avez pas pour l\'instant de professeur attitré')).toBeNull()
  })

  it('affiche une invitation à demander un professeur si aucune relation active', async () => {
    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Vous n\'avez pas pour l\'instant de professeur attitré')).toBeDefined()
    })
  })

  it('masque le bouton « Demander un professeur » et affiche « Changer de professeur » une fois un professeur assigné', async () => {
    mockFetchTeacherStudentRelations.mockResolvedValue([
      {
        teacherId: 'teacher-1',
        studentId: 'student-1',
        isPrincipalTeacher: true,
        teacherName: { firstName: 'Marie', lastName: 'Curie' },
      },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getAllByText('Marie Curie').length).toBeGreaterThan(0)
    })

    expect(screen.queryByText('Demander un professeur')).toBeNull()
    const changeLink = screen.getByText('Changer de professeur')
    expect(changeLink.closest('a')).toHaveAttribute('href', '/teacher-requests')
  })

  it('affiche « Vous n\'avez pas de prochain cours » avec un bouton désactivé quand un professeur est assigné mais aucun cours prévu', async () => {
    mockFetchTeacherStudentRelations.mockResolvedValue([
      {
        teacherId: 'teacher-1',
        studentId: 'student-1',
        isPrincipalTeacher: true,
        teacherName: { firstName: 'Marie', lastName: 'Curie' },
      },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Vous n\'avez pas de prochain cours')).toBeDefined()
    })

    const contactButton = screen.getByRole('button', { name: 'Contacter mon professeur' })
    expect(contactButton).toBeDisabled()
  })
})

describe('EleveDashboardPage — notifications', () => {
  it('affiche les notifications récentes', async () => {
    mockFetchNotifications.mockResolvedValue([
      { id: 'notif-1', message: 'Nouvelle activité disponible', read: false, createdAt: FUTURE_ISO_1 },
    ])

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByText('Nouvelle activité disponible')).toBeDefined()
    })
  })
})
