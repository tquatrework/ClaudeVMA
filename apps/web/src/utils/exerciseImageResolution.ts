/**
 * exerciseImageResolution.ts — résolution des images (bloc et solution) d'un formulaire
 * `ExerciseForm` en items `{type: 'image', imageData, ...}` prêts à embarquer dans le payload
 * `POST`/`PUT /exercises`.
 *
 * Extrait de `exercisePayload.ts` (redescendu sous 300 lignes) — ces deux fonctions effectuent de
 * vrais appels réseau/FileReader, contrairement à `buildExerciseCreatePayload` qui reste
 * synchrone : c'est la même séparation qui justifiait déjà `exerciseImageEncoding.ts`/
 * `exerciseImageConstraints.ts` comme fichiers distincts.
 */

import type { CreateExerciseItemPayload } from '../types/exercise'
import type { EditableExercisePart } from '../components/content-catalog/ExercisePartEditor'
import { fetchExercisePartImageBlob } from '../api/exercises'
import { readBlobAsBase64, readFileAsBase64 } from './exerciseImageEncoding'

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
 * Résout, pour chaque bloc question du formulaire, l'item `{type: 'image', imageData, ...}` à
 * embarquer dans `solution.items` — appelée **avant** `buildExerciseCreatePayload`, comme
 * `resolveExerciseImagePayloadItems` ci-dessus.
 *
 * Contrairement à un bloc image, une image de solution déjà enregistrée n'a **jamais** besoin
 * d'être relue par un appel réseau : `GET /exercises/:id/solutions` l'embarque déjà en base64
 * (`AuthorContentItem.imageData`, réservée à l'auteur et aux AP/RP/TI) au moment du chargement de
 * l'écran d'édition — ce base64 est simplement réinjecté tel quel s'il n'a pas été remplacé par un
 * nouveau fichier localement choisi. Confirmé par une vérification HTTP directe contre la
 * production le 2026-09-01 : `PUT /exercises/:id` accepte `solution.items[].imageData`.
 */
export async function resolveExerciseSolutionImagePayloadItems(
  parts: EditableExercisePart[],
): Promise<Map<string, CreateExerciseItemPayload>> {
  const resolved = new Map<string, CreateExerciseItemPayload>()

  await Promise.all(
    parts.map(async (part) => {
      if (part.category !== 'question') return

      if (part.solutionImageFile) {
        const imageData = await readFileAsBase64(part.solutionImageFile)
        resolved.set(part.localId, {
          type: 'image',
          imageData,
          imageOriginalFilename: part.solutionImageFile.name,
        })
        return
      }

      if (part.existingSolutionImageItem?.imageData) {
        resolved.set(part.localId, {
          type: 'image',
          imageData: part.existingSolutionImageItem.imageData,
          ...(part.existingSolutionImageItem.content
            ? { content: part.existingSolutionImageItem.content }
            : {}),
        })
      }
    }),
  )

  return resolved
}
