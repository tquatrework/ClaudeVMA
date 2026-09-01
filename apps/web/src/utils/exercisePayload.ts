/**
 * buildExerciseCreatePayload — traduit l'état d'édition de `ExerciseForm` en payload d'API
 * (`CreateExercisePayload`), ou lève une `ExerciseFormValidationError` avec un message français
 * directement affichable.
 *
 * Extrait de `ExerciseForm.tsx` pour rester lisible et testable isolément — même découpage que
 * `quizPayload.ts`/`QuizForm.tsx`.
 */

import type {
  AuthorExerciseDetail,
  AuthorExercisePart,
  CreateExerciseItemPayload,
  CreateExercisePayload,
  PublicContentItem,
  PublicExerciseDetail,
} from '../types/exercise'
import {
  createEditableExercisePart,
  type EditableExercisePart,
} from '../components/content-catalog/ExercisePartEditor'
import { createEditableExerciseItem, type EditableExerciseItem } from '../components/content-catalog/ExerciseItemListEditor'
import { fetchExercisePartImageBlob } from '../api/exercises'
import { readBlobAsBase64, readFileAsBase64 } from './exerciseImageEncoding'

/**
 * `description` a été retirée le 2026-09-01 (arbitrage « Titre des Exercices et des Quizz »,
 * point 4) : libère de l'espace à l'écran, demande explicite de l'utilisateur. Un exercice déjà
 * enregistré avec une description ne l'affiche simplement plus — elle n'est jamais relue ici.
 */
export interface EditableExerciseFormState {
  title: string
  level: string
  difficulty: string
  theme: string
  competenciesInput: string
  tagsInput: string
  parts: EditableExercisePart[]
}

/** Erreur de validation locale du formulaire — distincte d'une erreur réseau/API, jamais traduite
 * via `getErrorMessage` : son message est déjà le texte final à afficher. */
export class ExerciseFormValidationError extends Error {}

function splitCommaList(input: string): string[] {
  return input
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0)
}

function buildItemsPayload(items: EditableExerciseItem[]) {
  return items
    .filter((item) => item.content.trim().length > 0)
    .map((item) => ({ type: item.type, content: item.content.trim() }))
}

/**
 * Résout, pour chaque bloc image du formulaire, l'item `{type: 'image', imageData, ...}` à
 * embarquer dans le payload — appelée **avant** `buildExerciseCreatePayload`, car elle effectue de
 * vrais appels réseau (encodage local d'un fichier, ou relecture d'une image déjà enregistrée).
 *
 * Contrat réel confirmé par `content-catalog-service` (PR #191, 2026-09-01) : l'image transite en
 * base64 **dans le même appel** `POST`/`PUT /exercises`, aucune route multipart séparée n'existe.
 * `PUT /exercises/:id` remplace intégralement la structure et **supprime les images non
 * resoumises** — un bloc image déjà rempli en édition, sans nouveau fichier choisi, doit donc voir
 * son contenu **relu maintenant** (`fetchExercisePartImageBlob`, pendant que l'ancien `itemId` est
 * garanti valide) pour être réinjecté dans ce même appel, plutôt que d'être silencieusement perdu.
 */
export async function resolveExerciseImagePayloadItems(
  parts: EditableExercisePart[],
  existingExerciseId: string | undefined,
): Promise<Map<string, CreateExerciseItemPayload>> {
  const resolved = new Map<string, CreateExerciseItemPayload>()

  await Promise.all(
    parts.map(async (part) => {
      if (part.category !== 'image') return

      if (part.imageFile) {
        const imageData = await readFileAsBase64(part.imageFile)
        resolved.set(part.localId, {
          type: 'image',
          imageData,
          imageOriginalFilename: part.imageFile.name,
        })
        return
      }

      if (part.existingImageItem && existingExerciseId) {
        const blob = await fetchExercisePartImageBlob(existingExerciseId, part.existingImageItem.id)
        const imageData = await readBlobAsBase64(blob)
        resolved.set(part.localId, {
          type: 'image',
          imageData,
          ...(part.existingImageItem.content ? { content: part.existingImageItem.content } : {}),
        })
      }
    }),
  )

  return resolved
}

/**
 * Contraintes de composition minimale, vérifiées côté serveur (arbitrage du 2026-09-01, point 2) —
 * guidées ici avant soumission plutôt que de laisser échouer un appel réseau évitable : au moins un
 * bloc énoncé (peut être vide, voir ci-dessous) et au moins un bloc question non vide.
 *
 * @param resolvedImageItems résultat de `resolveExerciseImagePayloadItems`, appelée avant cette
 *   fonction (elle-même synchrone — la résolution des images est un préalable séparé).
 */
export function buildExerciseCreatePayload(
  state: EditableExerciseFormState,
  resolvedImageItems: Map<string, CreateExerciseItemPayload>,
): CreateExercisePayload {
  if (!state.title.trim()) {
    throw new ExerciseFormValidationError('Le titre est obligatoire.')
  }
  if (state.parts.length === 0) {
    throw new ExerciseFormValidationError('Ajoutez au moins un bloc (énoncé, image ou question).')
  }
  if (!state.parts.some((part) => part.category === 'statement')) {
    throw new ExerciseFormValidationError('Ajoutez au moins un bloc énoncé.')
  }
  if (!state.parts.some((part) => part.category === 'question')) {
    throw new ExerciseFormValidationError('Ajoutez au moins un bloc question.')
  }

  const parts = state.parts.map((part, index) => {
    if (part.category === 'image') {
      const resolvedItem = resolvedImageItems.get(part.localId)
      if (!resolvedItem) {
        throw new ExerciseFormValidationError(`Le bloc image ${index + 1} doit contenir une image.`)
      }
      return { category: 'image' as const, items: [resolvedItem] }
    }

    const items = buildItemsPayload(part.items)

    if (part.category === 'question') {
      if (items.length === 0) {
        throw new ExerciseFormValidationError(
          `Le bloc ${index + 1} (question) doit contenir au moins un élément.`,
        )
      }
      const solutionItems = buildItemsPayload(part.solutionItems)
      if (solutionItems.length === 0) {
        throw new ExerciseFormValidationError(
          `La solution du bloc ${index + 1} (question) est obligatoire.`,
        )
      }
      return { category: 'question' as const, items, solution: { items: solutionItems } }
    }

    // 'statement' — peut être vide (arbitrage du 2026-09-01, point 2).
    return { category: 'statement' as const, items }
  })

  const competencies = splitCommaList(state.competenciesInput)
  const tags = splitCommaList(state.tagsInput)

  return {
    title: state.title.trim(),
    ...(state.level.trim() ? { level: state.level.trim() } : {}),
    ...(state.difficulty.trim() ? { difficulty: state.difficulty.trim() } : {}),
    ...(state.theme.trim() ? { theme: state.theme.trim() } : {}),
    ...(competencies.length > 0 ? { competencies } : {}),
    ...(tags.length > 0 ? { tags } : {}),
    parts,
  }
}

/** Convertit une liste d'items serveur (texte/formule/image) en items éditables — les items
 * `image` sont **omis**, ce formulaire texte/formule ne sait jamais en porter (les blocs image ont
 * leur propre éditeur, `ExerciseImageBlockEditor`).
 */
function buildEditableItemsFromContent(items: PublicContentItem[]): EditableExerciseItem[] {
  return items
    .filter((item): item is typeof item & { type: 'text' | 'formula' } =>
      item.type === 'text' || item.type === 'formula',
    )
    .map((item) => {
      const editableItem = createEditableExerciseItem(item.type)
      editableItem.content = item.content ?? ''
      return editableItem
    })
}

/**
 * Construit l'état d'édition initial à partir d'un exercice déjà enregistré.
 *
 * Accepte soit `GET /exercises/:id` (`PublicExerciseDetail`, jamais de solution), soit
 * `GET /exercises/:id/solutions` (`AuthorExerciseDetail`, réservée à l'auteur et aux AP/RP/TI,
 * corrective du 2026-09-01 — voir `fetchExerciseForEdit` dans `api/exercises.ts`). Quand la
 * solution d'un bloc question est disponible, elle est réellement pré-remplie (items
 * texte/formule uniquement — une image de solution est désormais lisible en base64
 * (`AuthorContentItem.imageData`) mais n'est pas encore éditable depuis ce formulaire, texte/
 * formule seulement) ; sinon un seul élément vide est proposé, à ressaisir par l'auteur — signalé
 * explicitement à l'écran (`ExerciseEditPage`), jamais silencieusement vidé.
 *
 * Un bloc `category: 'image'` reprend son image déjà enregistrée dans `existingImageItem`
 * (affichée par `ExerciseImageBlockEditor` tant qu'aucun nouveau fichier n'est choisi) — voir
 * `docs/architecture.md` > « Bloc "image" de premier niveau pour l'Exercice ».
 */
export function buildEditableStateForExerciseEdit(
  exercise: PublicExerciseDetail | AuthorExerciseDetail,
): EditableExerciseFormState {
  const parts: EditableExercisePart[] = exercise.parts.map((part) => {
    const editablePart = createEditableExercisePart(part.category)
    const textOrFormulaItems = buildEditableItemsFromContent(part.items)

    const authorPart = part as AuthorExercisePart
    const prefilledSolutionItems =
      part.category === 'question' && authorPart.solution
        ? buildEditableItemsFromContent(authorPart.solution.items)
        : []

    const existingImageItem =
      part.category === 'image' ? (part.items.find((item) => item.type === 'image') ?? null) : null

    return {
      ...editablePart,
      items: textOrFormulaItems.length > 0 ? textOrFormulaItems : editablePart.items,
      solutionItems:
        part.category === 'question'
          ? prefilledSolutionItems.length > 0
            ? prefilledSolutionItems
            : editablePart.solutionItems
          : [],
      existingImageItem,
    }
  })

  return {
    title: exercise.title ?? '',
    level: exercise.level ?? '',
    difficulty: exercise.difficulty ?? '',
    theme: exercise.theme ?? '',
    competenciesInput: (exercise.competencies ?? []).join(', '),
    tagsInput: exercise.tags.join(', '),
    parts: parts.length > 0 ? parts : [createEditableExercisePart()],
  }
}
