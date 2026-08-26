/**
 * lightMarkup.ts — syntaxe légère textuelle pour le texte enrichi du cahier
 * de texte (`docs/architecture.md` > « Syntaxe legere unifiee pour le texte
 * enrichi », 2026-08-26).
 *
 * Aujourd'hui : liens `[label](url)`, reconnus dans une chaîne de texte et
 * transformés en vrais liens cliquables **au rendu, côté client uniquement**
 * — le champ reste un champ texte brut côté serveur, jamais transformé en
 * HTML stocké. Demain (phase 3, non implémenté ici) : notation mathématique
 * `$...$`/`$$...$$` rendue via KaTeX, sur le même principe (texte brut
 * stocké, transformé à l'affichage). Nommé génériquement — pas
 * `parseResourceLinks` ni équivalent — pour ne pas fermer cette porte.
 *
 * Remplace `resourceLinks` (champ structuré séparé, retiré le 2026-08-26
 * après retour utilisateur : le lien doit vivre **dans** le texte, pas à
 * côté).
 */

export type LightMarkupSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; label: string; url: string }

// `[label](url)` — l'URL doit être absolue http(s), jamais une URL relative
// ni un protocole `javascript:` (même exigence que l'ancienne validation de
// `resourceLinks`).
const INLINE_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g

/**
 * Découpe un texte brut en segments texte / lien, dans l'ordre d'apparition.
 * Un texte sans motif reconnu renvoie un unique segment `text`. Une chaîne
 * vide renvoie un tableau vide.
 */
export function parseLightMarkup(text: string): LightMarkupSegment[] {
  if (!text) return []

  const segments: LightMarkupSegment[] = []
  let lastIndex = 0
  INLINE_LINK_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = INLINE_LINK_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'link', label: match[1], url: match[2] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments
}

/** URL absolue `http://` ou `https://` uniquement — une URL relative ou `javascript:` est refusée. */
export function isAbsoluteHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

/** Construit la syntaxe `[label](url)` à insérer dans un champ texte. */
export function buildInlineLinkMarkup(label: string, url: string): string {
  return `[${label.trim()}](${url.trim()})`
}

export interface InsertAtSelectionResult {
  text: string
  /** Position du curseur juste après le texte inséré. */
  cursorPosition: number
}

/**
 * Insère `insertion` dans `text`, en remplaçant la sélection
 * `[selectionStart, selectionEnd)` — fonction pure, testable indépendamment
 * du DOM. Utilisée pour insérer un lien à la position du curseur d'un
 * `<textarea>`, au lieu de toujours l'ajouter en fin de texte.
 */
export function insertTextAtSelection(
  text: string,
  selectionStart: number,
  selectionEnd: number,
  insertion: string,
): InsertAtSelectionResult {
  const before = text.slice(0, selectionStart)
  const after = text.slice(selectionEnd)
  return {
    text: `${before}${insertion}${after}`,
    cursorPosition: before.length + insertion.length,
  }
}
