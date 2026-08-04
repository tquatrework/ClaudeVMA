/**
 * Utilitaires de formatage de noms d'utilisateur pour affichage humain.
 *
 * Partagé par les sections de rattachement élève ↔ parent financeur
 * (ParentFinanceurSection, PendingParentInvitationsList, LinkedStudentsSection,
 * PendingStudentRequestsList).
 */

/**
 * Construit un libellé humain à partir d'un prénom/nom, avec repli lisible sur
 * l'identifiant de connexion puis sur l'identifiant technique (UUID).
 *
 * Règles produit :
 * - Le prénom et le nom sont toujours prioritaires quand ils sont disponibles.
 * - L'identifiant (login, ou à défaut l'identifiant technique) est toujours affiché
 *   entre parenthèses, y compris quand le nom est connu, pour lever toute ambiguïté.
 * - Quand prénom/nom sont absents, un libellé générique de rôle (ex: "Financeur",
 *   "Élève") remplace le nom, mais l'identifiant reste affiché — jamais masqué,
 *   jamais réduit à un simple extrait d'UUID nu sans contexte.
 */
export function formatPersonDisplayName(
  firstName: string | undefined,
  lastName: string | undefined,
  loginIdentifier: string | null | undefined,
  technicalUserId: string | undefined,
  genericRoleLabel: string,
): string {
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const readableIdentifier = loginIdentifier || technicalUserId

  if (fullName) {
    return readableIdentifier ? `${fullName} (ID : ${readableIdentifier})` : fullName
  }

  if (readableIdentifier) {
    return `${genericRoleLabel} (ID : ${readableIdentifier})`
  }

  return `${genericRoleLabel} inconnu`
}
