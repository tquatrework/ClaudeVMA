import '@testing-library/jest-dom'

// jsdom does not implement scrollIntoView — provide a no-op stub
window.HTMLElement.prototype.scrollIntoView = function () {}

/**
 * jsdom n'implémente pas les object URLs. Le front en fabrique pour afficher les
 * fichiers rapportés par une route authentifiée (photo de profil : les octets
 * arrivent par requête, le JWT ne voyageant pas sur une balise `<img>`).
 *
 * Le stub produit une URL **distincte à chaque appel** : c'est ce qui permet aux
 * tests de vérifier qu'un remplacement révoque bien l'ancienne, plutôt que de
 * laisser fuir un blob par navigation.
 */
let createdObjectUrlCount = 0
if (!URL.createObjectURL) {
  URL.createObjectURL = () => `blob:visiomath/${++createdObjectUrlCount}`
}
if (!URL.revokeObjectURL) {
  URL.revokeObjectURL = () => {}
}

/**
 * jsdom n'implémente pas `Range.getClientRects`/`getBoundingClientRect` — ProseMirror (moteur de
 * l'éditeur riche du Tutoriel « post », `TutorialRichTextEditor`) les appelle à chaque frappe pour
 * faire défiler la sélection courante en vue (`EditorView.scrollToSelection`), ce qui fait
 * planter un test simulant une saisie réelle (`userEvent.type`) sans ce stub. Renvoyer un
 * rectangle nul est suffisant : le test n'a pas besoin d'un vrai positionnement visuel.
 */
const emptyDomRect: DOMRect = {
  x: 0,
  y: 0,
  top: 0,
  left: 0,
  bottom: 0,
  right: 0,
  width: 0,
  height: 0,
  toJSON: () => ({}),
}
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => [emptyDomRect] as unknown as DOMRectList
}
if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => emptyDomRect
}

/**
 * jsdom n'implémente pas non plus `document.elementFromPoint` — ProseMirror l'appelle au clic
 * (`posAtCoords`) pour retrouver la position du curseur sous le pointeur. `null` est une réponse
 * valide de cette API (« aucun élément à ce point ») : ProseMirror retombe alors sur son propre
 * calcul de position sans planter.
 */
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null
}
