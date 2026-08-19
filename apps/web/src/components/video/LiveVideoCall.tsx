import React, { useState } from 'react'
import { LiveKitRoom, VideoConference } from '@livekit/components-react'
import '@livekit/components-styles'
import { livekitUrlToCertificateTrustUrl } from '../../utils/livekitUrl'

interface LiveVideoCallProps {
  /** JWT LiveKit (réponse de GET /video/rooms/:id/join). */
  token: string
  /** URL `wss://` du serveur LiveKit à joindre en direct (réponse de la même route). */
  url: string
  /** Appelé quand l'utilisateur quitte l'appel (bouton "Quitter" de la librairie, ou erreur). */
  onLeave: () => void
}

/**
 * LiveVideoCall — composant vidéo intégré, partagé par VideoJoinPage et VideoPage
 * (chantier calendrier-visio-livekit, point 4). Encapsule `<LiveKitRoom>` +
 * `<VideoConference>` de `@livekit/components-react` : caméra, micro, participants et contrôles
 * sont fournis par la librairie, rien n'est réimplémenté ici.
 *
 * Gère explicitement trois états, en plus de l'appel en cours lui-même :
 * - connexion en cours (avant le premier `onConnected`) ;
 * - erreur de connexion — message dédié si elle correspond à un certificat auto-signé non encore
 *   accepté par le navigateur (voir docs/routes.md > video-session-service > « TLS pour le port
 *   LiveKit ») ;
 * - fin d'appel (`onDisconnected`) : ramène l'appelant à un état cohérent via `onLeave`, jamais
 *   une déconnexion silencieuse.
 */
export default function LiveVideoCall({ token, url, onLeave }: LiveVideoCallProps) {
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const certificateTrustUrl = livekitUrlToCertificateTrustUrl(url)

  if (connectionError) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm space-y-3">
        <p>{connectionError}</p>
        {certificateTrustUrl && (
          <p>
            Si c'est votre première connexion, ouvrez{' '}
            <a
              href={certificateTrustUrl}
              target="_blank"
              rel="noreferrer"
              className="underline font-medium"
            >
              cette adresse
            </a>{' '}
            dans un nouvel onglet et acceptez l'avertissement de sécurité, puis réessayez.
          </p>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="text-sm text-red-700 border border-red-300 px-4 py-2 rounded-lg hover:bg-red-100"
        >
          Revenir en arrière
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {!isConnected && <p className="text-gray-400 text-sm">Connexion à la visio…</p>}

      <LiveKitRoom
        token={token}
        serverUrl={url}
        connect
        video
        audio
        data-lk-theme="default"
        style={{ height: '70vh', display: isConnected ? undefined : 'none' }}
        onConnected={() => setIsConnected(true)}
        onDisconnected={() => {
          setIsConnected(false)
          onLeave()
        }}
        onError={(caughtError) => {
          setConnectionError(
            `Impossible de se connecter à la visio (${caughtError.message}). Vérifiez votre connexion.`,
          )
        }}
      >
        <VideoConference />
      </LiveKitRoom>
    </div>
  )
}
