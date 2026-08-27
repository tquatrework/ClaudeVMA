/**
 * lightMarkup.ts — syntaxe légère textuelle pour le texte enrichi du cahier
 * de texte et du Mémo (`docs/architecture.md` > « Syntaxe legere unifiee
 * pour le texte enrichi », 2026-08-26).
 *
 * Liens `[label](url)` et notation mathématique `$...$`/`$$...$$`, reconnus
 * dans une chaîne de texte et transformés au rendu **côté client
 * uniquement** — le champ reste un champ texte brut côté serveur, jamais
 * transformé en HTML/MathML stocké. Le segment `math` est la première mise
 * en œuvre réelle de la notation mathématique anticipée le 2026-08-26 (rendu
 * KaTeX, chantier Mémo — `MathRenderer.tsx`) ; il vaut aussi bien pour un
 * item texte de mémo contenant une formule inline que pour une future
 * évaluation de `content-catalog-service` (phase 3), sans nouvelle
 * architecture parallèle.
 *
 * Remplace `resourceLinks` (champ structuré séparé, retiré le 2026-08-26
 * après retour utilisateur : le lien doit vivre **dans** le texte, pas à
 * côté).
 */

export type LightMarkupSegment =
  | { type: 'text'; value: string }
  | { type: 'link'; label: string; url: string }
  | { type: 'math'; latex: string; displayMode: boolean }

// Un seul passage combine les trois motifs reconnus, dans l'ordre où ils
// apparaissent dans le texte — un unique `RegExpExecArray` par occurrence,
// distingué par le groupe capturant non vide :
//   1-2 : lien `[label](url)` — URL absolue http(s) uniquement
//   3   : bloc mathématique `$$...$$` (displayMode)
//   4   : formule inline `$...$` (jamais multi-lignes, jamais `$$`)
const COMBINED_PATTERN =
  /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|\$\$([^$]+?)\$\$|\$([^$\n]+?)\$/g

/**
 * Découpe un texte brut en segments texte / lien / math, dans l'ordre
 * d'apparition. Un texte sans motif reconnu renvoie un unique segment
 * `text`. Une chaîne vide renvoie un tableau vide.
 */
export function parseLightMarkup(text: string): LightMarkupSegment[] {
  if (!text) return []

  const segments: LightMarkupSegment[] = []
  let lastIndex = 0
  COMBINED_PATTERN.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = COMBINED_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }

    if (match[1] !== undefined) {
      segments.push({ type: 'link', label: match[1], url: match[2] })
    } else if (match[3] !== undefined) {
      segments.push({ type: 'math', latex: match[3].trim(), displayMode: true })
    } else if (match[4] !== undefined) {
      segments.push({ type: 'math', latex: match[4].trim(), displayMode: false })
    }

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

/**
 * Reconstruit la syntaxe brute `$latex$`/`$$latex$$` d'un segment `math` —
 * utilisée par `LightMarkupEditor` pour réafficher un segment math comme
 * texte éditable (il ne rend pas de jeton pour les formules, seulement pour
 * les liens ; portée volontairement étroite du chantier Mémo, 2026-08-27).
 */
export function buildMathMarkup(segment: { latex: string; displayMode: boolean }): string {
  return segment.displayMode ? `$$${segment.latex}$$` : `$${segment.latex}$`
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
 * du DOM. Utilisée pour insérer un lien à la position du curseur, au lieu de
 * toujours l'ajouter en fin de texte.
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

// ─── Éditeur « jetons » (LightMarkupEditor, 2026-08-27) ────────────────────
//
// Correctif du défaut « l'URL doit rester cachée dès l'insertion du lien » :
// un lien inséré doit s'afficher comme un jeton portant uniquement son
// libellé (jamais les crochets ni l'URL) pendant la saisie elle-même, pas
// seulement une fois l'entrée enregistrée. Un calque de coloration au-dessus
// d'un `<textarea>` transparent ne peut pas cacher des caractères sans
// désynchroniser le curseur natif du texte réel qu'il masque (constat déjà
// documenté dans l'ancien `LightMarkupTextarea`). `LightMarkupEditor` retient
// donc une zone `contentEditable` où chaque lien est un « jeton » atomique
// (`contentEditable=false`) affichant seulement le libellé, le texte alentour
// restant librement éditable. Le texte brut `[label](url)` n'existe qu'au
// moment de la sérialisation (`serializeLightMarkupEditor`) — jamais stocké
// ni envoyé sous une autre forme que ce texte brut.
//
// Ces fonctions restent volontairement pures vis-à-vis de React (elles ne
// prennent que des `Node`/`Range` du DOM standard) pour rester testables
// indépendamment du composant.

/** Attribut posé sur chaque jeton de lien rendu par `LightMarkupEditor`. */
export const LIGHT_MARKUP_CHIP_ATTR = 'data-light-markup-chip'
export const LIGHT_MARKUP_LABEL_ATTR = 'data-light-markup-label'
export const LIGHT_MARKUP_URL_ATTR = 'data-light-markup-url'

function isChipElement(node: Node): node is HTMLElement {
  return node.nodeType === 1 && (node as HTMLElement).hasAttribute(LIGHT_MARKUP_CHIP_ATTR)
}

function chipMarkup(node: HTMLElement): string {
  return buildInlineLinkMarkup(
    node.getAttribute(LIGHT_MARKUP_LABEL_ATTR) ?? '',
    node.getAttribute(LIGHT_MARKUP_URL_ATTR) ?? '',
  )
}

/**
 * Longueur, en caractères de texte brut, occupée par un nœud une fois
 * sérialisé — un jeton compte pour la longueur de `[label](url)` entier
 * (jamais celle, plus courte, du seul libellé affiché), un `<br>` pour un
 * retour à la ligne, un nœud texte pour son contenu réel.
 */
function nodeRawLength(node: Node): number {
  if (isChipElement(node)) return chipMarkup(node).length
  if (node.nodeType === 3) return (node.textContent ?? '').length
  if (node.nodeName === 'BR') return 1
  // Nœud imprévu (ex. un <div> introduit par la gestion native de la touche
  // Entrée d'un navigateur) : traité récursivement, +1 pour le saut de ligne
  // implicite qu'il représente — voir `serializeLightMarkupEditor`.
  return serializeLightMarkupEditor(node).length + 1
}

/**
 * Reconstruit le texte brut `[label](url)` à partir du DOM courant de
 * l'éditeur — la seule valeur jamais transmise à `onChange`/au serveur.
 * Aucun HTML n'est jamais lu au-delà de cette reconstruction textuelle.
 */
export function serializeLightMarkupEditor(root: Node): string {
  let result = ''
  root.childNodes.forEach((node) => {
    if (isChipElement(node)) {
      result += chipMarkup(node)
    } else if (node.nodeType === 3) {
      result += node.textContent ?? ''
    } else if (node.nodeName === 'BR') {
      result += '\n'
    } else {
      // Nœud imprévu : on ne perd pas son contenu, on le traite comme une ligne.
      result += `${serializeLightMarkupEditor(node)}\n`
    }
  })
  return result
}

/**
 * Convertit une position DOM (nœud + offset, telle que rendue par
 * `Selection`/`Range`) en un offset de caractères dans le texte brut
 * sérialisé — pour retrouver « où en est l'utilisateur » dans le texte réel
 * malgré des jetons de largeur différente de leur rendu visuel.
 */
export function rawOffsetFromDomPosition(root: Node, node: Node, domOffset: number): number {
  let offset = 0
  for (const child of Array.from(root.childNodes)) {
    if (child === node) {
      return offset + domOffset
    }
    if ((node.parentNode as Node | null) === child && node !== root) {
      // Position à l'intérieur d'un enfant non textuel (ex. le jeton
      // lui-même, bien qu'il soit non éditable) : on se cale après lui.
      return offset + nodeRawLength(child)
    }
    offset += nodeRawLength(child)
  }
  if (node === root) {
    let consumed = 0
    const children = Array.from(root.childNodes)
    for (let index = 0; index < Math.min(domOffset, children.length); index += 1) {
      consumed += nodeRawLength(children[index])
    }
    return consumed
  }
  return offset
}

export interface DomPosition {
  node: Node
  offset: number
}

/**
 * Fonction réciproque de `rawOffsetFromDomPosition` : retrouve la position
 * DOM (nœud + offset) correspondant à un offset de caractères du texte brut,
 * pour replacer le curseur après une insertion programmatique (bouton
 * « Insérer un lien »). Un jeton est atomique : un offset tombant à
 * l'intérieur de son intervalle est ramené juste après lui, jamais à
 * l'intérieur (on n'édite pas un lien caractère par caractère).
 */
export function domPositionForRawOffset(root: HTMLElement, rawOffset: number): DomPosition {
  let consumed = 0
  const children = Array.from(root.childNodes)
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    const length = nodeRawLength(child)
    if (child.nodeType === 3) {
      if (rawOffset <= consumed + length) {
        return { node: child, offset: rawOffset - consumed }
      }
    } else if (rawOffset === consumed) {
      // Exactement au début de ce nœud atomique (ex. tout premier enfant) :
      // se caler juste avant lui, jamais après.
      return { node: root, offset: index }
    } else if (rawOffset <= consumed + length) {
      return { node: root, offset: index + 1 }
    }
    consumed += length
  }
  return { node: root, offset: children.length }
}
