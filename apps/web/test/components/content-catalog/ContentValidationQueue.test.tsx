/**
 * Tests pour ContentValidationQueue (Phase 12)
 *
 * Couvre :
 * - Affiche "Aucun contenu" quand les trois listes sont vides
 * - Affiche les exercices en attente dans l'onglet Exercices
 * - Les boutons Valider/Rejeter déclenchent le callback onValidateContent
 * - La navigation entre onglets fonctionne
 * - Le compteur total des contenus en attente est correct
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ContentValidationQueue from '../../../src/components/content-catalog/ContentValidationQueue'
import type { Exercise, Evaluation, Tutorial } from '../../../src/api/contentCatalog'

const PENDING_EXERCISE: Exercise = {
  id: 'ex-1',
  title: 'Limites et continuité',
  description: 'Étude des limites en terminale',
  subject: 'Mathématiques',
  level: 'Terminale',
  difficultyLevel: 'moyen',
  status: 'pending_validation',
  authorId: 'teacher-1',
  hasSolution: true,
  createdAt: '2026-06-15T08:00:00Z',
}

const PENDING_EVALUATION: Evaluation = {
  id: 'eval-1',
  title: 'DS Dérivées',
  description: 'Évaluation sur les dérivées',
  subject: 'Mathématiques',
  level: 'Première',
  difficultyLevel: 'difficile',
  status: 'pending_validation',
  authorId: 'teacher-1',
  hasSolution: true,
  durationMinutes: 60,
  createdAt: '2026-06-15T09:00:00Z',
}

const PENDING_TUTORIAL: Tutorial = {
  id: 'tuto-1',
  title: 'Introduction aux intégrales',
  description: 'Tutoriel vidéo sur les intégrales',
  subject: 'Mathématiques',
  level: 'Terminale',
  status: 'pending_validation',
  authorId: 'teacher-1',
  createdAt: '2026-06-15T10:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ContentValidationQueue', () => {
  it('affiche "Aucun contenu en attente" quand tout est vide', () => {
    render(
      <ContentValidationQueue
        pendingExercises={[]}
        pendingEvaluations={[]}
        pendingTutorials={[]}
        onValidateContent={vi.fn()}
      />,
    )

    expect(screen.getByText(/Aucun contenu en attente de validation/)).toBeDefined()
  })

  it('affiche les exercices en attente dans l\'onglet Exercices', () => {
    render(
      <ContentValidationQueue
        pendingExercises={[PENDING_EXERCISE]}
        pendingEvaluations={[]}
        pendingTutorials={[]}
        onValidateContent={vi.fn()}
      />,
    )

    expect(screen.getByText('Limites et continuité')).toBeDefined()
    expect(screen.getByText('Étude des limites en terminale')).toBeDefined()
  })

  it('affiche le compteur total correct', () => {
    render(
      <ContentValidationQueue
        pendingExercises={[PENDING_EXERCISE]}
        pendingEvaluations={[PENDING_EVALUATION]}
        pendingTutorials={[PENDING_TUTORIAL]}
        onValidateContent={vi.fn()}
      />,
    )

    expect(screen.getByText('3 contenus en attente')).toBeDefined()
  })

  it('le bouton Valider déclenche onValidateContent avec decision=approve', async () => {
    const onValidateContent = vi.fn()

    render(
      <ContentValidationQueue
        pendingExercises={[PENDING_EXERCISE]}
        pendingEvaluations={[]}
        pendingTutorials={[]}
        onValidateContent={onValidateContent}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /valider/i }))

    expect(onValidateContent).toHaveBeenCalledWith('exercise', 'ex-1', 'approve')
  })

  it('le bouton Rejeter déclenche onValidateContent avec decision=reject', async () => {
    const onValidateContent = vi.fn()

    render(
      <ContentValidationQueue
        pendingExercises={[PENDING_EXERCISE]}
        pendingEvaluations={[]}
        pendingTutorials={[]}
        onValidateContent={onValidateContent}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /rejeter/i }))

    expect(onValidateContent).toHaveBeenCalledWith('exercise', 'ex-1', 'reject')
  })

  it('navigue vers l\'onglet Évaluations et affiche les évaluations en attente', async () => {
    render(
      <ContentValidationQueue
        pendingExercises={[]}
        pendingEvaluations={[PENDING_EVALUATION]}
        pendingTutorials={[]}
        onValidateContent={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /évaluations/i }))

    expect(screen.getByText('DS Dérivées')).toBeDefined()
  })

  it('navigue vers l\'onglet Tutoriels et affiche les tutoriels en attente', async () => {
    render(
      <ContentValidationQueue
        pendingExercises={[]}
        pendingEvaluations={[]}
        pendingTutorials={[PENDING_TUTORIAL]}
        onValidateContent={vi.fn()}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /tutoriels/i }))

    expect(screen.getByText('Introduction aux intégrales')).toBeDefined()
  })

  it('affiche "Aucun exercice en attente" dans l\'onglet Exercices quand la liste est vide', async () => {
    render(
      <ContentValidationQueue
        pendingExercises={[]}
        pendingEvaluations={[PENDING_EVALUATION]}
        pendingTutorials={[]}
        onValidateContent={vi.fn()}
      />,
    )

    // L'onglet Exercices est actif par défaut
    expect(screen.getByText(/Aucun exercice en attente/)).toBeDefined()
  })
})
