/**
 * exerciseImageUpload.ts — orchestration du flux en deux temps pour les blocs image d'un Exercice
 * (arbitrage du 2026-09-01, `docs/architecture.md` > « Bloc "image" de premier niveau pour
 * l'Exercice »).
 *
 * Le contenu binaire ne peut jamais transiter par le DTO JSON de création/édition
 * (`CreateExercisePayload`) : la structure (avec les blocs image en placeholder, `items: []`) est
 * créée/mise à jour d'abord (`POST`/`PUT /exercises`), puis chaque image en attente est envoyée
 * séparément au bloc réel nouvellement créé, via `uploadExercisePartImage`
 * (`POST /exercises/:id/parts/:partId/images`) — même route que l'ancien mécanisme
 * `ExerciseImageManager`, réutilisée telle quelle.
 *
 * ⚠️ Hypothèse posée faute de contrat confirmé côté `content-catalog-service` au moment de
 * l'écriture de ce code (branche `feat/content-catalog-exercise-image-block` non encore poussée) :
 * le serveur renvoie `parts[]` dans le **même ordre** que celui soumis dans le payload — c'est ce
 * qui permet de faire correspondre un fichier en attente (position `i` dans le formulaire local) au
 * `partId` réel nouvellement créé (position `i` dans la réponse). À vérifier/ajuster dès que le
 * rapport du sous-agent `content-catalog-service` est disponible.
 */

import { fetchExercisePartImageBlob, uploadExercisePartImage } from '../api/exercises'
import type { EditableExercisePart } from '../components/content-catalog/ExercisePartEditor'
import type { PublicExerciseDetail } from '../types/exercise'

function guessFileExtension(mimeType: string | null | undefined): string {
  switch (mimeType) {
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    case 'image/gif':
      return 'gif'
    default:
      return 'jpg'
  }
}

/**
 * Pré-résout, pour chaque bloc du formulaire, le fichier à envoyer après l'enregistrement de la
 * structure : `null` pour un bloc non-image, le fichier nouvellement choisi par l'utilisateur, ou —
 * en édition, sans nouveau choix — le contenu déjà enregistré, **récupéré maintenant** plutôt
 * qu'après le `PUT`.
 *
 * Ce choix protège contre un comportement serveur non confirmé : si `PUT /exercises/:id` efface le
 * contenu binaire des blocs image à chaque remplacement de structure (comme c'était documenté pour
 * l'ancien mécanisme), récupérer l'ancien contenu après le `PUT` serait trop tard — l'ancien
 * `itemId` pourrait déjà être invalide. Le récupérer avant élimine ce risque, que le serveur efface
 * ou non.
 */
export async function resolvePendingExerciseImages(
  parts: EditableExercisePart[],
  existingExerciseId: string | undefined,
): Promise<(File | null)[]> {
  return Promise.all(
    parts.map(async (part) => {
      if (part.category !== 'image') return null
      if (part.imageFile) return part.imageFile
      if (part.existingImageItem && existingExerciseId) {
        const blob = await fetchExercisePartImageBlob(existingExerciseId, part.existingImageItem.id)
        const extension = guessFileExtension(part.existingImageItem.imageMimeType ?? blob.type)
        return new File([blob], `image.${extension}`, {
          type: blob.type || part.existingImageItem.imageMimeType || 'application/octet-stream',
        })
      }
      return null
    }),
  )
}

/**
 * Envoie chaque image en attente au bloc réel correspondant, une fois la structure enregistrée.
 * `pendingFiles` doit être dans le même ordre que les blocs d'origine (voir
 * `resolvePendingExerciseImages`, appelée avant `createExercise`/`updateExercise`). Renvoie
 * l'exercice avec les images fraîchement envoyées fusionnées — jamais un second `GET` : la réponse
 * de chaque envoi porte déjà le nouvel item (règle du projet, 2026-08-10, point 3bis).
 */
export async function uploadPendingExerciseImages(
  saved: PublicExerciseDetail,
  pendingFiles: (File | null)[],
): Promise<PublicExerciseDetail> {
  let current = saved

  for (let index = 0; index < pendingFiles.length; index += 1) {
    const file = pendingFiles[index]
    const savedPart = current.parts[index]
    if (!file || !savedPart) continue

    const uploadedItem = await uploadExercisePartImage(current.id, savedPart.id, file)
    current = {
      ...current,
      parts: current.parts.map((part) =>
        part.id === savedPart.id ? { ...part, items: [uploadedItem] } : part,
      ),
    }
  }

  return current
}
