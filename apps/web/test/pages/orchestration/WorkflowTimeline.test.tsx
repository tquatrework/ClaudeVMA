/**
 * Tests pour WorkflowTimeline (Phase 16)
 *
 * Couvre :
 * - Affichage de l'état de chargement
 * - Affichage du détail d'une instance avec ses étapes
 * - Les statuts completed, pending et failed sont visibles
 * - L'action "Suspendre" est disponible pour les admins quand le workflow est en cours
 * - L'action "Reprendre" est disponible quand le workflow est en arbitrage
 * - L'action "Forcer la reprise (TI)" n'est visible que pour le TI
 * - Un élève voit un message d'accès refusé
 * - Gestion d'erreur de chargement
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/orchestration')

import { useAuth } from '../../../src/hooks/useAuth'
import {
  fetchWorkflowInstance,
  suspendWorkflow,
  resumeWorkflow,
} from '../../../src/api/orchestration'
import WorkflowTimeline from '../../../src/pages/WorkflowTimeline'
import type { WorkflowInstanceDetail } from '../../../src/api/orchestration'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchWorkflowInstance = vi.mocked(fetchWorkflowInstance)
const mockSuspendWorkflow = vi.mocked(suspendWorkflow)
const mockResumeWorkflow = vi.mocked(resumeWorkflow)

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

const TI_USER = {
  id: 'ti-1',
  email: 'ti@test.com',
  role: 'technicien_informatique' as const,
  validationStatus: 'active' as const,
}

const RP_USER = {
  id: 'rp-1',
  email: 'rp@test.com',
  role: 'responsable_pedagogique' as const,
  validationStatus: 'active' as const,
}

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

function buildAuthMock(userObj = TI_USER) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() =>
      (
        [
          'responsable_pedagogique',
          'animateur_pedagogique',
          'technicien_informatique',
          'administrateur_financier',
        ] as string[]
      ).includes(userObj.role),
    ),
  }
}

// ─── Fixtures instances ───────────────────────────────────────────────────────

const INSTANCE_IN_PROGRESS: WorkflowInstanceDetail = {
  status: 'in_progress',
  instance: {
    workflowInstanceId: 'wf-instance-123',
    workflowType: 'student-onboarding',
    correlationId: 'corr-abc-123',
    status: 'in_progress',
    startedAt: '2026-06-18T10:00:00Z',
  },
  steps: [
    {
      order: 1,
      service: 'identity-access-service',
      action: 'create-account',
      status: 'completed',
      startedAt: '2026-06-18T10:00:01Z',
      completedAt: '2026-06-18T10:00:02Z',
    },
    {
      order: 2,
      service: 'profile-service',
      action: 'create-student-profiles',
      status: 'in_progress',
      startedAt: '2026-06-18T10:00:03Z',
    },
    {
      order: 3,
      service: 'dashboard-notification-service',
      action: 'initialize-dashboard',
      status: 'pending',
    },
  ],
}

const INSTANCE_NEEDS_ARBITRATION: WorkflowInstanceDetail = {
  status: 'needs_arbitration',
  instance: {
    workflowInstanceId: 'wf-instance-456',
    workflowType: 'teacher-onboarding',
    correlationId: 'corr-def-456',
    status: 'needs_arbitration',
    startedAt: '2026-06-18T09:00:00Z',
  },
  steps: [
    {
      order: 1,
      service: 'identity-access-service',
      action: 'create-account',
      status: 'completed',
    },
  ],
}

const INSTANCE_WITH_FAILED_STEP: WorkflowInstanceDetail = {
  status: 'failed',
  instance: {
    workflowInstanceId: 'wf-instance-789',
    workflowType: 'scheduled-video-course',
    correlationId: 'corr-ghi-789',
    status: 'failed',
    startedAt: '2026-06-18T08:00:00Z',
  },
  steps: [
    {
      order: 1,
      service: 'calendar-service',
      action: 'plan-activity',
      status: 'failed',
      errorMessage: 'Créneau indisponible',
    },
  ],
}

const INSTANCE_ID = 'wf-instance-123'

function renderPage(instanceId = INSTANCE_ID) {
  return render(
    <MemoryRouter initialEntries={[`/admin/orchestration/workflows/${instanceId}`]}>
      <Routes>
        <Route path="/admin/orchestration/workflows/:workflowInstanceId" element={<WorkflowTimeline />} />
      </Routes>
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockFetchWorkflowInstance.mockResolvedValue(INSTANCE_IN_PROGRESS)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WorkflowTimeline', () => {
  it('affiche l\'état de chargement initialement', () => {
    mockFetchWorkflowInstance.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(screen.getByText(/Chargement de l'instance de workflow/)).toBeDefined()
  })

  it('affiche le type et le statut du workflow', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('student-onboarding')).toBeDefined()
      expect(screen.getAllByText('En cours').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('affiche les étapes du workflow', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Étape 1 — identity-access-service/)).toBeDefined()
      expect(screen.getByText(/Étape 2 — profile-service/)).toBeDefined()
      expect(screen.getByText(/Étape 3 — dashboard-notification-service/)).toBeDefined()
    })
  })

  it('affiche les différents statuts d\'étapes (completed, in_progress, pending)', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Terminé')).toBeDefined()
      expect(screen.getAllByText('En cours').length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText('En attente')).toBeDefined()
    })
  })

  it('affiche le message d\'erreur d\'une étape échouée', async () => {
    mockFetchWorkflowInstance.mockResolvedValue(INSTANCE_WITH_FAILED_STEP)
    renderPage('wf-instance-789')
    await waitFor(() => {
      expect(screen.getByText('Créneau indisponible')).toBeDefined()
    })
  })

  it('affiche le bouton "Suspendre le workflow" quand le workflow est en cours', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /suspendre le workflow/i })).toBeDefined()
    })
  })

  it('le bouton "Suspendre" n\'est pas visible pour un workflow en arbitrage', async () => {
    mockFetchWorkflowInstance.mockResolvedValue(INSTANCE_NEEDS_ARBITRATION)
    renderPage('wf-instance-456')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /suspendre le workflow/i })).toBeNull()
    })
  })

  it('affiche le bouton "Reprendre" quand le workflow nécessite un arbitrage', async () => {
    mockFetchWorkflowInstance.mockResolvedValue(INSTANCE_NEEDS_ARBITRATION)
    renderPage('wf-instance-456')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /reprendre$/i })).toBeDefined()
    })
  })

  it('le TI voit le bouton "Forcer la reprise"', async () => {
    mockFetchWorkflowInstance.mockResolvedValue(INSTANCE_NEEDS_ARBITRATION)
    renderPage('wf-instance-456')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /forcer la reprise/i })).toBeDefined()
    })
  })

  it('le RP ne voit pas le bouton "Forcer la reprise (TI)"', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(RP_USER))
    mockFetchWorkflowInstance.mockResolvedValue(INSTANCE_NEEDS_ARBITRATION)
    renderPage('wf-instance-456')
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /forcer la reprise/i })).toBeNull()
    })
  })

  it('le TI peut ouvrir le formulaire de suspension', async () => {
    renderPage()
    await waitFor(() => {
      screen.getByRole('button', { name: /suspendre le workflow/i })
    })
    await userEvent.click(screen.getByRole('button', { name: /suspendre le workflow/i }))
    expect(screen.getByText('Motif de suspension')).toBeDefined()
    expect(screen.getByLabelText(/Motif de suspension/i)).toBeDefined()
  })

  it('le TI peut suspendre un workflow', async () => {
    mockSuspendWorkflow.mockResolvedValue({
      workflowInstanceId: INSTANCE_ID,
      status: 'needs_arbitration',
      reason: 'Besoin de vérification',
    })
    renderPage()

    await waitFor(() => {
      screen.getByRole('button', { name: /suspendre le workflow/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /suspendre le workflow/i }))
    await userEvent.type(screen.getByLabelText(/Motif de suspension/i), 'Besoin de vérification')
    await userEvent.click(screen.getByRole('button', { name: /confirmer la suspension/i }))

    await waitFor(() => {
      expect(mockSuspendWorkflow).toHaveBeenCalledWith(INSTANCE_ID, {
        reason: 'Besoin de vérification',
      })
    })
  })

  it('un élève voit un message d\'accès refusé', () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    expect(screen.getByText(/Accès réservé aux techniciens informatiques/)).toBeDefined()
  })

  it('affiche une erreur si le chargement échoue', async () => {
    mockFetchWorkflowInstance.mockRejectedValue(new Error('Not found'))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Impossible de charger cette instance de workflow/)).toBeDefined()
    })
  })
})
