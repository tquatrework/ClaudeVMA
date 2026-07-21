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
      message?: string
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
  422: "La demande n'a pas pu être traitée. Vérifiez les informations saisies.",
}

const DEFAULT_MESSAGE = 'Une erreur est survenue. Veuillez réessayer.'
const NETWORK_ERROR_MESSAGE = 'Impossible de contacter le serveur. Vérifiez votre connexion.'
const SERVER_ERROR_MESSAGE = 'Le serveur rencontre un problème. Veuillez réessayer plus tard.'

/**
 * Traduit une erreur (HTTP ou réseau) en message lisible pour l'utilisateur final.
 *
 * Ordre de priorité :
 * 1. Message métier renvoyé par le backend (`response.data.message`), s'il existe — c'est
 *    l'information la plus précise (ex. règle métier violée).
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
  const backendMessage = apiError?.response?.data?.message

  if (typeof backendMessage === 'string' && backendMessage.trim().length > 0) {
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
