/**
 * buildTutorialCreatePayload — traduit l'état d'édition de `TutorialForm` en payload d'API
 * (`CreateTutorialPayload`), ou lève une `TutorialFormValidationError` avec un message français
 * directement affichable. Même découpage que `exercisePayload.ts`/`ExerciseForm.tsx`.
 */

import type {
  CreateTutorialBlockPayload,
  CreateTutorialPayload,
  PublicTutorialDetail,
  TutorialBlockCategory,
  TutorialFormat,
} from '../types/tutorial'
import {
  createEditableTutorialBlock,
  type EditableTutorialBlock,
} from '../components/content-catalog/TutorialBlockEditor'

export interface EditableTutorialFormState {
  title: string
  tagsInput: string
  description: string
  level: string
  difficulty: string
  theme: string
  competenciesInput: string
  format: TutorialFormat
  videoUrl: string
  linkedQuizId: string | null
  blocks: EditableTutorialBlock[]
}

/** Erreur de validation locale du formulaire — son message est déjà le texte final à afficher. */
export class TutorialFormValidationError extends Error {}

function splitCommaList(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

/**
 * @param resolvedImageBlocks résultat de `resolveTutorialImagePayloadBlocks`, appelée avant cette
 *   fonction (elle-même synchrone — la résolution des images est un préalable séparé).
 */
export function buildTutorialCreatePayload(
  state: EditableTutorialFormState,
  resolvedImageBlocks: Map<string, CreateTutorialBlockPayload>,
): CreateTutorialPayload {
  if (!state.title.trim()) {
    throw new TutorialFormValidationError('Le titre est obligatoire.')
  }

  const competencies = splitCommaList(state.competenciesInput)
  const tags = splitCommaList(state.tagsInput)

  const basePayload = {
    title: state.title.trim(),
    ...(state.description.trim() ? { description: state.description.trim() } : {}),
    ...(state.theme.trim() ? { theme: state.theme.trim() } : {}),
    ...(state.level.trim() ? { level: state.level.trim() } : {}),
    ...(state.difficulty.trim() ? { difficulty: state.difficulty.trim() } : {}),
    ...(competencies.length > 0 ? { competencies } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    ...(state.linkedQuizId ? { linkedQuizId: state.linkedQuizId } : {}),
  }

  if (state.format === 'video') {
    const videoUrl = state.videoUrl.trim()
    if (!videoUrl) {
      throw new TutorialFormValidationError("L'adresse de la vidéo est obligatoire.")
    }
    return { ...basePayload, format: 'video', videoUrl }
  }

  // format === 'post'
  const blocks: CreateTutorialBlockPayload[] = []
  state.blocks.forEach((block, index) => {
    if (block.category === 'image') {
      const resolved = resolvedImageBlocks.get(block.localId)
      if (!resolved) {
        throw new TutorialFormValidationError(`Le bloc image ${index + 1} doit contenir une image.`)
      }
      blocks.push(resolved)
      return
    }

    // Un bloc titre/texte laissé vide est silencieusement omis, plutôt que refusé — même
    // discipline que `buildItemsPayload` (exercisePayload.ts) pour les items texte/formule.
    const trimmedContent = block.content.trim()
    if (trimmedContent.length === 0) return
    blocks.push({ category: block.category as Exclude<TutorialBlockCategory, 'image'>, content: trimmedContent })
  })

  if (blocks.length === 0) {
    throw new TutorialFormValidationError('Ajoutez au moins un bloc avec du contenu (titre, texte ou image).')
  }

  return { ...basePayload, format: 'post', blocks }
}

/** Convertit les blocs déjà enregistrés d'un tutoriel en état d'édition. */
export function buildEditableStateForTutorialEdit(
  tutorial: PublicTutorialDetail,
): EditableTutorialFormState {
  const blocks: EditableTutorialBlock[] = tutorial.blocks.map((block) => {
    const editableBlock = createEditableTutorialBlock(block.category)
    return {
      ...editableBlock,
      content: block.category === 'image' ? '' : (block.content ?? ''),
      existingImageBlock: block.category === 'image' ? block : null,
    }
  })

  return {
    title: tutorial.title ?? '',
    tagsInput: tutorial.tags.join(', '),
    description: tutorial.description ?? '',
    level: tutorial.level ?? '',
    difficulty: tutorial.difficulty ?? '',
    theme: tutorial.theme ?? '',
    competenciesInput: (tutorial.competencies ?? []).join(', '),
    format: tutorial.format,
    videoUrl: tutorial.videoUrl ?? '',
    linkedQuizId: tutorial.linkedQuizId ?? null,
    blocks: blocks.length > 0 ? blocks : [createEditableTutorialBlock()],
  }
}
