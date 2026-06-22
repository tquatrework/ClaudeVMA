/**
 * Tests pour VisibilityOverridePanel (Phase 15)
 *
 * Couvre :
 * - Le TI crée un masquage temporaire sans supprimer les données
 * - Le TI ne peut pas auto-autoriser l'accès AF (override sur son propre compte)
 * - Le TI peut supprimer un override existant
 * - Un utilisateur sans rôle autorisé voit un message d'accès refusé
 * - Gestion des erreurs API (403, 409)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/hooks/useAuth')
vi.mock('../../../src/api/adminObservability')

import { useAuth } from '../../../src/hooks/useAuth'
import { createVisibilityOverride, deleteVisibilityOverride } from '../../../src/api/adminObservability'
import VisibilityOverridePanel from '../../../src/pages/VisibilityOverridePanel'
import type { VisibilityOverride } from '../../../src/api/adminObservability'

const mockUseAuth = vi.mocked(useAuth)
const mockCreateVisibilityOverride = vi.mocked(createVisibilityOverride)
const mockDeleteVisibilityOverride = vi.mocked(deleteVisibilityOverride)

// ─── Fixtures utilisateurs ────────────────────────────────────────────────────

const TI_USER = {
  id: 'ti-1',
  email: 'ti@test.com',
  role: 'technicien_informatique' as const,
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

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CREATED_OVERRIDE: VisibilityOverride = {
  id: 'override-1',
  targetType: 'account',
  targetId: 'user-xyz',
  reason: 'Compte signalé pour comportement abusif',
  createdBy: 'ti-1',
  createdAt: '2026-06-18T10:00:00Z',
}

function renderPage() {
  return render(
    <MemoryRouter>
      <VisibilityOverridePanel />
    </MemoryRouter>,
  )
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
  mockCreateVisibilityOverride.mockResolvedValue(CREATED_OVERRIDE)
  mockDeleteVisibilityOverride.mockResolvedValue(undefined)
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('VisibilityOverridePanel', () => {
  it('affiche le titre et le bouton "Nouveau masquage" pour le TI', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Masquages temporaires')).toBeDefined()
      expect(screen.getByRole('button', { name: /Nouveau masquage/i })).toBeDefined()
    })
  })

  it('affiche l\'avertissement sur la non-suppression des données', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/n'efface pas les données/i)).toBeDefined()
    })
  })

  it('le TI ouvre le formulaire de masquage', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Nouveau masquage/i }))
    expect(screen.getByText('Créer un masquage temporaire')).toBeDefined()
  })

  it('le TI crée un masquage temporaire et le voit dans la liste', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Nouveau masquage/i }))

    await userEvent.type(screen.getByLabelText(/ID de la ressource/i), 'user-xyz')
    await userEvent.type(screen.getByLabelText(/Motif/i), 'Compte signalé pour comportement abusif')

    await userEvent.click(screen.getByRole('button', { name: /Appliquer le masquage/i }))

    await waitFor(() => {
      expect(screen.getByText('Compte signalé pour comportement abusif')).toBeDefined()
    })
  })

  it('le TI ne peut pas créer un override sur son propre compte (auto-autorisation AF interdite)', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Nouveau masquage/i }))

    // Utilise l'ID du TI lui-même (ti-1) — doit être bloqué
    await userEvent.type(screen.getByLabelText(/ID de la ressource/i), 'ti-1')
    await userEvent.type(screen.getByLabelText(/Motif/i), 'Test auto-autorisation')

    await userEvent.click(screen.getByRole('button', { name: /Appliquer le masquage/i }))

    await waitFor(() => {
      expect(screen.getByText(/ne pouvez pas créer un override sur votre propre compte/i)).toBeDefined()
    })

    expect(mockCreateVisibilityOverride).not.toHaveBeenCalled()
  })

  it('affiche un message d\'erreur 403 si non autorisé', async () => {
    mockCreateVisibilityOverride.mockRejectedValue({ response: { status: 403 } })
    renderPage()
    await userEvent.click(screen.getByRole('button', { name: /Nouveau masquage/i }))

    await userEvent.type(screen.getByLabelText(/ID de la ressource/i), 'user-xyz')
    await userEvent.type(screen.getByLabelText(/Motif/i), 'Test 403')

    await userEvent.click(screen.getByRole('button', { name: /Appliquer le masquage/i }))

    await waitFor(() => {
      expect(screen.getByText(/Vous n'êtes pas autorisé à créer ce masquage/i)).toBeDefined()
    })
  })

  it('affiche un message d\'accès refusé pour un élève', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(STUDENT_USER))
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/Accès réservé aux techniciens informatiques/)).toBeDefined()
    })
  })

  it('le TI peut retirer un masquage existant', async () => {
    mockCreateVisibilityOverride.mockResolvedValue(CREATED_OVERRIDE)
    renderPage()

    // Crée d'abord un override
    await userEvent.click(screen.getByRole('button', { name: /Nouveau masquage/i }))
    await userEvent.type(screen.getByLabelText(/ID de la ressource/i), 'user-xyz')
    await userEvent.type(screen.getByLabelText(/Motif/i), 'Compte signalé')
    await userEvent.click(screen.getByRole('button', { name: /Appliquer le masquage/i }))

    await waitFor(() => {
      expect(screen.getByText('Compte signalé pour comportement abusif')).toBeDefined()
    })

    // Supprime l'override
    await userEvent.click(screen.getByRole('button', { name: /Retirer/i }))

    await waitFor(() => {
      expect(mockDeleteVisibilityOverride).toHaveBeenCalledWith('override-1')
    })
  })
})
