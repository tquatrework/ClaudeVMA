/**
 * Tests pour LiveVideoCall — composant vidéo intégré partagé par VideoJoinPage et VideoPage
 * (chantier calendrier-visio-livekit, point 4).
 *
 * `@livekit/components-react` est mocké : ce composant ne peut pas établir de vraie connexion
 * WebRTC/WebSocket dans jsdom. Le mock capture les props passées à `LiveKitRoom` pour que les
 * tests déclenchent eux-mêmes `onConnected`/`onDisconnected`/`onError`, exactement comme le
 * ferait la vraie librairie une fois connectée à un vrai serveur LiveKit.
 */

import type { ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import LiveVideoCall from '../../../src/components/video/LiveVideoCall'

interface CapturedLiveKitRoomProps {
  onConnected?: () => void
  onDisconnected?: () => void
  onError?: (error: Error) => void
}

let capturedProps: CapturedLiveKitRoomProps = {}

vi.mock('@livekit/components-react', () => ({
  LiveKitRoom: (props: CapturedLiveKitRoomProps & { children?: ReactNode }) => {
    capturedProps = props
    return <div data-testid="livekit-room">{props.children}</div>
  },
  VideoConference: () => <div data-testid="video-conference" />,
}))

vi.mock('@livekit/components-styles', () => ({}))

const TOKEN = 'jwt-token-xyz'
const URL = 'wss://193.108.54.226:7880'

beforeEach(() => {
  capturedProps = {}
})

describe('LiveVideoCall — connexion en cours', () => {
  it("affiche un message de connexion avant l'événement onConnected", () => {
    render(<LiveVideoCall token={TOKEN} url={URL} onLeave={vi.fn()} />)

    expect(screen.getByText('Connexion à la visio…')).toBeDefined()
  })
})

describe('LiveVideoCall — connexion réussie', () => {
  it('affiche la conférence vidéo après onConnected et masque le message de connexion', () => {
    render(<LiveVideoCall token={TOKEN} url={URL} onLeave={vi.fn()} />)

    act(() => {
      capturedProps.onConnected?.()
    })

    expect(screen.getByTestId('video-conference')).toBeDefined()
    expect(screen.queryByText('Connexion à la visio…')).toBeNull()
  })
})

describe('LiveVideoCall — fin d’appel', () => {
  it('appelle onLeave quand la librairie signale une déconnexion', () => {
    const onLeave = vi.fn()
    render(<LiveVideoCall token={TOKEN} url={URL} onLeave={onLeave} />)

    act(() => {
      capturedProps.onConnected?.()
    })
    act(() => {
      capturedProps.onDisconnected?.()
    })

    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})

describe('LiveVideoCall — erreur de connexion', () => {
  it('affiche un message clair en français avec un lien vers le certificat auto-signé', async () => {
    render(<LiveVideoCall token={TOKEN} url={URL} onLeave={vi.fn()} />)

    act(() => {
      capturedProps.onError?.(new Error('WebSocket connection failed'))
    })

    expect(screen.getByText(/impossible de se connecter à la visio/i)).toBeDefined()

    const trustLink = screen.getByRole('link', { name: /cette adresse/i })
    expect(trustLink.getAttribute('href')).toBe('https://193.108.54.226:7880/')
  })

  it('permet de revenir en arrière depuis un état d’erreur', async () => {
    const onLeave = vi.fn()
    render(<LiveVideoCall token={TOKEN} url={URL} onLeave={onLeave} />)

    act(() => {
      capturedProps.onError?.(new Error('boom'))
    })

    await userEvent.click(screen.getByRole('button', { name: /revenir en arrière/i }))

    expect(onLeave).toHaveBeenCalledTimes(1)
  })
})
