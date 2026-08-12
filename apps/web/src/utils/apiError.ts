/**
 * apiError.ts — traduction uniforme des erreurs HTTP/réseau en message lisible.
 *
 * Reprend le vocabulaire déjà utilisé dans les pages existantes (ex. "Accès refusé",
 * "Une erreur est survenue. Veuillez réessayer.") pour que les futurs hooks métier de
 * `src/hooks/<domaine>/` n'aient pas à réinventer un mapping statut → message à chaque fois.
 *
 * Convention des erreurs interceptées : les appels `src/api/*` rejettent des erreurs de
 * transport (axios ou assimilé), de forme `{ response?: { status, data?: { message } } }`.
 */

interface ApiErrorShape {
  response?: {
    status?: number
    data?: {
      // NestJS renvoie une chaîne pour les erreurs métier, et un tableau pour les
      // violations de validation (`ValidationPipe`).
      message?: string | string[]
    }
  }
  request?: unknown
  message?: string
}

const STATUS_MESSAGES: Record<number, string> = {
  400: "La demande n'a pas pu être traitée. Vérifiez les informations saisies.",
  401: 'Votre session a expiré. Veuillez vous reconnecter.',
  403: "Vous n'êtes pas autorisé à effectuer cette action.",
  404: 'Ressource introuvable.',
  409: 'Cette action entre en conflit avec une donnée existante.',
  // Envoi de fichier refusé pour son poids — par le service, ou par le serveur
  // web en amont (qui répond alors une page HTML sans message exploitable).
  413: 'Le fichier envoyé est trop lourd. Choisissez un fichier plus léger.',
  422: "La demande n'a pas pu être traitée. Vérifiez les informations saisies.",
}

const DEFAULT_MESSAGE = 'Une erreur est survenue. Veuillez réessayer.'
const NETWORK_ERROR_MESSAGE = 'Impossible de contacter le serveur. Vérifiez votre connexion.'
const SERVER_ERROR_MESSAGE = 'Le serveur rencontre un problème. Veuillez réessayer plus tard.'

/**
 * Message affiché quand le serveur refuse des champs qu'il ne déclare pas
 * (`400` « champs inconnus »). L'utilisateur ne peut rien corriger à l'écran : la
 * cause est un décalage entre la version du front chargée dans son navigateur et
 * celle du serveur. On lui dit quoi faire, sans lui montrer de noms de champs.
 */
const UNKNOWN_FIELDS_MESSAGE =
  "Cette page n'est plus à jour avec le serveur. Rechargez la page, puis réessayez. Si le problème persiste, contactez le support."

/**
 * Marqueurs du refus de champs inconnus, tels que renvoyés par identity-access-service
 * (garde `reject-unknown-body-fields`) et par `ValidationPipe({forbidNonWhitelisted})`.
 * Ces libellés sont techniques et en anglais : ils ne doivent jamais atteindre l'écran.
 */
const UNKNOWN_FIELDS_MARKERS = ['accepted fields for this route', 'unknown field']

/**
 * Messages techniques en anglais émis par les gardes de rôle des services, qui ne
 * doivent jamais atteindre l'écran (règle de langue du 2026-08-09 : tout ce que
 * l'utilisateur lit est en français).
 *
 * Ils n'apportent rien de plus que le code HTTP, dont `STATUS_MESSAGES` porte déjà la
 * traduction. Les vrais messages métier, eux, sont en français et restent affichés tels
 * quels — c'est justement pour ne pas les écraser que la liste est nommément fermée
 * plutôt que d'ignorer tout message sur un `401`/`403`.
 *
 * Constaté contre la pile réelle le 2026-08-12 : `teacher-request-service` répond
 * `403 {"message":"You do not have the required role for this action"}` à un élève qui
 * tenterait d'annuler sa demande.
 */
const UNTRANSLATED_GUARD_MESSAGES = [
  'you do not have the required role for this action',
  'insufficient role',
  'forbidden',
  'unauthorized',
]

/** Le message du serveur est-il un libellé technique anglais à ne pas afficher ? */
function isUntranslatedGuardMessage(backendMessage: string): boolean {
  return UNTRANSLATED_GUARD_MESSAGES.includes(backendMessage.trim().toLowerCase())
}

/** Concatène le message backend, qu'il soit une chaîne ou un tableau de violations. */
export function readBackendMessage(error: unknown): string {
  const backendMessage = (error as ApiErrorShape)?.response?.data?.message
  if (typeof backendMessage === 'string') return backendMessage
  if (Array.isArray(backendMessage)) {
    return backendMessage.filter((part) => typeof part === 'string').join(' ')
  }
  return ''
}

/**
 * L'erreur est-elle un refus de champs inconnus par le serveur ?
 *
 * Ce cas signale un décalage de déploiement front/back, jamais une saisie fautive :
 * il mérite donc un message d'action (recharger) plutôt qu'un « vérifiez vos
 * informations » qui enverrait l'utilisateur corriger un formulaire correct.
 */
export function isUnknownFieldsRejection(error: unknown): boolean {
  if (getErrorStatus(error) !== 400) return false
  const backendMessage = readBackendMessage(error).toLowerCase()
  return UNKNOWN_FIELDS_MARKERS.some((marker) => backendMessage.includes(marker))
}

/**
 * Traduit une erreur (HTTP ou réseau) en message lisible pour l'utilisateur final.
 *
 * Ordre de priorité :
 * 0. Refus de champs inconnus (`400`) : message d'action dédié — le détail technique
 *    (noms de champs, anglais) est journalisé pour le développeur, jamais affiché.
 * 1. Message métier renvoyé par le backend (`response.data.message`), s'il existe — c'est
 *    l'information la plus précise (ex. règle métier violée). **Sauf** s'il s'agit d'un
 *    libellé technique anglais de garde de rôle, qui n'apporte rien de plus que le code
 *    HTTP et violerait la règle de langue ; on retombe alors sur le point 2.
 * 2. Message par défaut associé au code HTTP (401 / 403 / 404 / 409 / 400 / 422).
 * 3. Message générique « serveur indisponible » pour les codes 5xx.
 * 4. Message générique « réseau » si la requête n'a reçu aucune réponse.
 * 5. `fallback` fourni par l'appelant, pour un message contextualisé
 *    (ex. « Impossible de charger les exercices. »).
 * 6. Message générique par défaut.
 *
 * @param error erreur inconnue capturée depuis un `catch`, typiquement une erreur axios.
 * @param fallback message par défaut propre au contexte d'appel (optionnel).
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  const apiError = error as ApiErrorShape

  const status = apiError?.response?.status

  if (isUnknownFieldsRejection(error)) {
    // Décalage front/back : inexploitable par l'utilisateur, mais indispensable au
    // développeur pour identifier le champ fautif.
    console.error('[apiError] champs refusés par le serveur :', readBackendMessage(error))
    return UNKNOWN_FIELDS_MESSAGE
  }

  const backendMessage = apiError?.response?.data?.message

  if (
    typeof backendMessage === 'string' &&
    backendMessage.trim().length > 0 &&
    !isUntranslatedGuardMessage(backendMessage)
  ) {
    return backendMessage
  }

  if (typeof status === 'number') {
    if (STATUS_MESSAGES[status]) {
      return STATUS_MESSAGES[status]
    }
    if (status >= 500) {
      return SERVER_ERROR_MESSAGE
    }
  }

  // Erreur réseau : la requête est partie mais aucune réponse n'est revenue
  // (axios expose alors `error.request` sans `error.response`).
  if (!apiError?.response && apiError?.request) {
    return NETWORK_ERROR_MESSAGE
  }

  return fallback ?? DEFAULT_MESSAGE
}

/**
 * Extrait le code de statut HTTP d'une erreur, si disponible.
 * Utile pour des branchements spécifiques (ex. rediriger sur 401) en complément du message.
 */
export function getErrorStatus(error: unknown): number | undefined {
  return (error as ApiErrorShape)?.response?.status
}
