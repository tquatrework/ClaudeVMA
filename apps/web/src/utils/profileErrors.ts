/**
 * Messages d'erreur des écritures de profil — en français, comme tout ce que
 * l'utilisateur lit.
 *
 * `profile-service` renvoie des messages techniques en anglais (listes de champs
 * refusés par `forbidNonWhitelisted`, noms de sections). Les afficher tels quels
 * reviendrait à montrer des noms de champs internes à l'utilisateur. On traduit
 * donc par section d'écriture, en disant ce qui bloque et qui peut agir.
 */

import { getErrorMessage, getErrorStatus, readBackendMessage } from './apiError'

/** Section d'écriture concernée, qui détermine la formulation du message. */
export type ProfileWriteSection = 'administrative' | 'declarative' | 'prescription'

const FORBIDDEN_MESSAGES: Record<ProfileWriteSection, string> = {
  administrative: "Vous n'êtes pas autorisé à modifier ce profil administratif.",
  declarative: "Vous n'êtes pas autorisé à modifier ce profil pédagogique.",
  // Cas central de ce chantier : le titulaire lit sa prescription, il ne l'écrit
  // jamais — même sur son propre profil. Le dire explicitement évite qu'il croie
  // à une panne.
  prescription:
    "La prescription est rédigée par le responsable pédagogique. Vous pouvez la consulter, pas la modifier.",
}

const INVALID_FIELD_MESSAGES: Record<ProfileWriteSection, string> = {
  administrative:
    "Certaines informations saisies n'ont pas été acceptées. Vérifiez les champs, puis réessayez.",
  declarative:
    "Certaines informations saisies ne relèvent pas de ce profil (elles appartiennent à l'autre type de profil, ou à la prescription du responsable pédagogique). Rechargez la page, puis réessayez.",
  prescription:
    "Certaines informations saisies ne relèvent pas de la prescription de ce profil. Rechargez la page, puis réessayez.",
}

/**
 * Traduit une erreur d'écriture de profil en message affichable.
 *
 * - `403` : refus de droit, formulé selon la section — pour la prescription, on
 *   explique qui l'écrit plutôt que d'afficher « accès refusé ».
 * - `400` : champ interdit, champ de l'autre rôle, ou `filledBy`/`filledAt`
 *   envoyés — le détail technique reste en console pour le développeur.
 * - autres : repli sur la traduction générique de `apiError`.
 */
export function getProfileWriteErrorMessage(
  error: unknown,
  section: ProfileWriteSection,
): string {
  const status = getErrorStatus(error)

  if (status === 403) return FORBIDDEN_MESSAGES[section]

  if (status === 400) {
    const backendDetail = readBackendMessage(error)
    if (backendDetail) {
      console.error(`[profile:${section}] écriture refusée par le serveur :`, backendDetail)
    }
    return INVALID_FIELD_MESSAGES[section]
  }

  return getErrorMessage(error, "Erreur lors de l'enregistrement")
}

/** Message affiché quand la lecture d'un profil échoue. */
export function getProfileReadErrorMessage(error: unknown): string {
  const status = getErrorStatus(error)
  if (status === 403) return 'Accès refusé'
  if (status === 404) return 'Profil introuvable'
  return 'Erreur lors du chargement du profil'
}
