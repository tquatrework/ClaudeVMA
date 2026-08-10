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
