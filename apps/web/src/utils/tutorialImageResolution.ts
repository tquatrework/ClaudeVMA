/**
 * tutorialImageResolution.ts — résolution des images de bloc d'un formulaire `TutorialForm` en
 * items `{category: 'image', imageData, ...}` prêts à embarquer dans le payload
 * `POST`/`PUT /tutorials`.
 *
 * Même mécanisme que `exerciseImageResolution.ts` (réutilise ses fonctions d'encodage pures,
 * `readFileAsBase64`/`readBlobAsBase64` — l'encodage local d'un fichier n'a rien de spécifique à
 * l'Exercice, aucune raison d'en écrire un second) : `PUT /tutorials/:id` remplace intégralement
 * la structure et **supprime les images non resoumises** — un bloc image déjà rempli en édition,
 * sans nouveau fichier choisi, doit donc voir son contenu **relu maintenant**
 * (`fetchTutorialBlockImageBlob`, pendant que l'ancien `blockId` est garanti valide) pour être
 * réinjecté dans ce même appel, plutôt que d'être silencieusement perdu.
 */

import type { CreateTutorialBlockPayload } from '../types/tutorial'
import type { EditableTutorialBlock } from '../components/content-catalog/TutorialBlockEditor'
import { fetchTutorialBlockImageBlob } from '../api/tutorials'
import { readBlobAsBase64, readFileAsBase64 } from './exerciseImageEncoding'

/**
 * Résout, pour chaque bloc image du formulaire, l'item `{category: 'image', imageData, ...}` à
 * embarquer dans le payload — appelée **avant** la construction du payload final, car elle
 * effectue de vrais appels réseau (encodage local d'un fichier, ou relecture d'une image déjà
 * enregistrée).
 */
export async function resolveTutorialImagePayloadBlocks(
  blocks: EditableTutorialBlock[],
  existingTutorialId: string | undefined,
): Promise<Map<string, CreateTutorialBlockPayload>> {
  const resolved = new Map<string, CreateTutorialBlockPayload>()

  await Promise.all(
    blocks.map(async (block) => {
      if (block.category !== 'image') return

      if (block.imageFile) {
        const imageData = await readFileAsBase64(block.imageFile)
        resolved.set(block.localId, {
          category: 'image',
          imageData,
          imageOriginalFilename: block.imageFile.name,
        })
        return
      }

      if (block.existingImageBlock && existingTutorialId) {
        const blob = await fetchTutorialBlockImageBlob(
          existingTutorialId,
          block.existingImageBlock.id,
        )
        const imageData = await readBlobAsBase64(blob)
        resolved.set(block.localId, {
          category: 'image',
          imageData,
          ...(block.existingImageBlock.content ? { content: block.existingImageBlock.content } : {}),
        })
      }
    }),
  )

  return resolved
}
