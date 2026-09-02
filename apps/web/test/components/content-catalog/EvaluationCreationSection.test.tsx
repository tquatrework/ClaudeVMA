/**
 * Tests pour EvaluationCreationSection — reprise du brouillon après un aller-retour vers
 * `/content/exercises` (2026-09-02, boutons « Nouveau »/« Rechercher » d'`EvaluationExercisePicker`).
 *
 * Couvre le « côté retour » du mécanisme : quand `EvaluationCatalogPage` fournit un `resumedDraft`
 * non nul (Exercice choisi/créé fusionné dans le brouillon relu depuis `sessionStorage`), le
 * formulaire de création doit s'ouvrir automatiquement, pré-rempli avec le titre déjà saisi et
 * l'Exercice ajouté à la liste — et `onResumedDraftConsumed` doit être appelé pour que la page
 * parente ne réutilise pas ce même brouillon à une prochaine ouverture normale du formulaire.
 */

import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'
import { EvaluationCreationSection } from '../../../src/components/content-catalog/EvaluationCreationSection'
import type { EditableEvaluationFormState } from '../../../src/utils/evaluationDraft'

function renderSection(resumedDraft?: EditableEvaluationFormState | null) {
  const onEvaluationCreated = vi.fn()
  const onOpenCreateForm = vi.fn()
  const onListsChanged = vi.fn()
  const onResumedDraftConsumed = vi.fn()

  render(
    <MemoryRouter>
      <EvaluationCreationSection
        canCreateEvaluation
        onEvaluationCreated={onEvaluationCreated}
        onOpenCreateForm={onOpenCreateForm}
        onListsChanged={onListsChanged}
        resumedDraft={resumedDraft}
        onResumedDraftConsumed={onResumedDraftConsumed}
      />
    </MemoryRouter>,
  )

  return { onEvaluationCreated, onOpenCreateForm, onListsChanged, onResumedDraftConsumed }
}

const DRAFT: EditableEvaluationFormState = {
  title: 'Évaluation reprise',
  level: '',
  difficulty: '',
  theme: '',
  competenciesInput: '',
  tagsInput: '',
  durationMinutes: '45',
  blockBackNavigation: false,
  exerciseItems: [{ exerciseId: 'ex-existant', title: 'Exercice déjà choisi', titleOverride: '' }],
}

describe('EvaluationCreationSection — reprise après retour de /content/exercises', () => {
  it("n'ouvre pas le formulaire quand aucun brouillon n'est en attente", () => {
    renderSection(null)

    expect(screen.getByRole('button', { name: /créer une nouvelle évaluation/i })).toBeDefined()
    expect(screen.queryByLabelText(/^titre/i)).toBeNull()
  })

  it('ouvre automatiquement le formulaire pré-rempli quand un brouillon repris est fourni, et signale sa consommation', () => {
    const { onResumedDraftConsumed } = renderSection(DRAFT)

    // Le formulaire est ouvert directement, sans clic sur « Créer une nouvelle évaluation ».
    expect(screen.getByDisplayValue('Évaluation reprise')).toBeDefined()
    expect(screen.getByDisplayValue('45')).toBeDefined()
    expect(screen.getByText('Exercice déjà choisi')).toBeDefined()

    expect(onResumedDraftConsumed).toHaveBeenCalledTimes(1)
  })
})
