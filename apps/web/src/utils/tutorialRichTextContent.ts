/**
 * tutorialRichTextContent.ts — sérialisation, désérialisation et détection de contenu vide pour
 * le document structuré (TipTap) porté par un bloc `text` de Tutoriel « post » (arbitrage du
 * 2026-09-03, `docs/architecture/contenu-pedagogique-quizz-exercices-evaluations.md` > « Éditeur
 * riche (WYSIWYG) pour les blocs texte du Tutoriel 'post' »).
 *
 * Le champ `content` d'un bloc `text` reste, côté backend, une donnée opaque (texte ou JSON) —
 * ce module est le point d'entrée UNIQUE qui interprète cette chaîne côté front :
 * `content-catalog-service` ne la parse ni ne l'interprète jamais lui-même, et aucun autre fichier
 * front ne doit reconstruire sa propre logique de parsing/emptiness.
 */

import type { JSONContent } from '@tiptap/core'

/** Document vide — un unique paragraphe sans contenu. */
export const EMPTY_TUTORIAL_RICH_TEXT_DOCUMENT: JSONContent = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
}

/**
 * Un bloc « text » enregistré avant cette révision (2026-09-03) portait du texte brut avec la
 * syntaxe légère du projet (`$...$`, `[label](url)`) — jamais du JSON. Un contenu qui ne se parse
 * pas comme un document TipTap valide (`type: 'doc'`) est donc traité comme du texte brut
 * historique, enveloppé dans un unique paragraphe, plutôt que de planter l'éditeur ou la lecture
 * (point 6 de l'arbitrage : « au minimum, ne pas planter sur du contenu qui n'est pas au nouveau
 * format structuré »).
 */
export function parseTutorialRichTextContent(content: string | null | undefined): JSONContent {
  if (!content) return EMPTY_TUTORIAL_RICH_TEXT_DOCUMENT

  try {
    const parsed = JSON.parse(content) as unknown
    if (parsed && typeof parsed === 'object' && (parsed as { type?: unknown }).type === 'doc') {
      return parsed as JSONContent
    }
  } catch {
    // Contenu non JSON : traité ci-dessous comme du texte brut historique.
  }

  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: content }] }],
  }
}

/** Sérialise le document structuré en chaîne — c'est la seule forme envoyée au serveur. */
export function serializeTutorialRichTextContent(document: JSONContent): string {
  return JSON.stringify(document)
}

function nodeHasContent(node: JSONContent): boolean {
  if (node.type === 'text' && (node.text ?? '').trim().length > 0) return true
  if (node.type === 'tutorialFormula') return true
  return (node.content ?? []).some(nodeHasContent)
}

/**
 * Un bloc dont le document ne porte aucun texte réel ni formule est considéré vide — utilisé par
 * `buildTutorialCreatePayload` pour omettre silencieusement un bloc texte laissé vide, même
 * discipline que les autres champs texte/formule du projet (Exercice, Mémo).
 */
export function isTutorialRichTextEmpty(document: JSONContent): boolean {
  return !nodeHasContent(document)
}
