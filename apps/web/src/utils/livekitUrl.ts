/**
 * livekitUrl.ts — traduction de l'URL WebSocket LiveKit (`wss://…`, renvoyée par
 * `GET /video/rooms/:id/join`) vers l'URL HTTPS équivalente que l'utilisateur doit ouvrir dans un
 * nouvel onglet pour accepter le certificat auto-signé de test (voir
 * `docs/routes.md` > video-session-service > « TLS pour le port LiveKit »).
 *
 * Fonction pure, aucun appel réseau.
 */

/**
 * Convertit une URL `wss://host:port` (ou `ws://`) en son équivalent HTTPS (ou HTTP) navigable —
 * `wss:` → `https:`, `ws:` → `http:`, port et hôte conservés. Retourne `null` si `url` n'est pas
 * une URL exploitable, pour que l'appelant affiche un repli plutôt qu'un lien cassé.
 */
export function livekitUrlToCertificateTrustUrl(url: string | undefined | null): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'wss:') {
      parsed.protocol = 'https:'
    } else if (parsed.protocol === 'ws:') {
      parsed.protocol = 'http:'
    } else {
      return null
    }
    return parsed.toString()
  } catch {
    return null
  }
}
