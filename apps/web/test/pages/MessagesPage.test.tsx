/**
 * Tests for MessagesPage
 *
 * Covers:
 * - Conversation list loading from GET /conversations
 * - Empty state when no conversations
 * - Selecting a conversation loads messages via GET /messages/conversation/:id
 * - Unread messages are marked read (PATCH /messages/:id/read)
 * - Sending a message calls POST /conversations/:id/messages
 * - Creating a new conversation calls POST /conversations
 * - Error state when conversations fail to load
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MessagesPage from '../../src/pages/MessagesPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/client')

import { useAuth } from '../../src/hooks/useAuth'
import apiClient from '../../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

const AUTH_USER = {
  user: {
    id: 'user-1',
    email: 'user@test.com',
    role: 'eleve' as const,
    validationStatus: 'active' as const,
  },
  isAuthenticated: true,
  isLoading: false,
  login: vi.fn(),
  logout: vi.fn(),
  hasRole: vi.fn(() => false),
  isInternalRole: vi.fn(() => false),
}

function renderMessages() {
  return render(
    <MemoryRouter>
      <MessagesPage />
    </MemoryRouter>,
  )
}

const SAMPLE_CONVERSATIONS = [
  { id: 'conv-1', participantEmail: 'prof@test.com', lastMessage: 'Bonjour', unreadCount: 2 },
  { id: 'conv-2', participantEmail: 'parent@test.com', lastMessage: null, unreadCount: 0 },
]

const SAMPLE_MESSAGES = [
  { id: 'msg-1', senderId: 'prof-1', content: 'Bonjour !', read: false, createdAt: new Date().toISOString() },
  { id: 'msg-2', senderId: 'user-1', content: 'Merci !', read: true, createdAt: new Date().toISOString() },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(AUTH_USER)
})

describe('MessagesPage', () => {
  it('shows loading indicator while fetching conversations', () => {
    mockApiClient.get = vi.fn().mockReturnValue(new Promise(() => {}))

    renderMessages()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders conversation list', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_CONVERSATIONS })

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText('prof@test.com')).toBeDefined()
      expect(screen.getByText('parent@test.com')).toBeDefined()
    })
  })

  it('shows empty state when no conversations exist', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText('Aucune conversation')).toBeDefined()
    })
  })

  it('shows error when conversations fail to load', async () => {
    mockApiClient.get = vi.fn().mockRejectedValue({ response: { status: 500 } })

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les messages')).toBeDefined()
    })
  })

  it('shows unread count badge for conversations with unread messages', async () => {
    mockApiClient.get = vi.fn().mockResolvedValue({ data: SAMPLE_CONVERSATIONS })

    renderMessages()

    await waitFor(() => {
      // conv-1 has unreadCount: 2
      expect(screen.getByText('2')).toBeDefined()
    })
  })

  it('loads messages when a conversation is selected', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: SAMPLE_CONVERSATIONS })
      if (url === '/messages/conversation/conv-1') return Promise.resolve({ data: SAMPLE_MESSAGES })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: {} })

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText('prof@test.com')).toBeDefined()
    })

    await userEvent.click(screen.getByText('prof@test.com'))

    await waitFor(() => {
      expect(screen.getByText('Bonjour !')).toBeDefined()
      expect(screen.getByText('Merci !')).toBeDefined()
    })
  })

  it('calls PATCH /messages/:id/read for unread messages when opening a conversation', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: SAMPLE_CONVERSATIONS })
      if (url === '/messages/conversation/conv-1') return Promise.resolve({ data: SAMPLE_MESSAGES })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: {} })

    renderMessages()

    await waitFor(() => {
      screen.getByText('prof@test.com')
    })

    await userEvent.click(screen.getByText('prof@test.com'))

    await waitFor(() => {
      // msg-1 is unread — should trigger PATCH
      expect(mockApiClient.patch).toHaveBeenCalledWith('/messages/msg-1/read')
    })
  })

  it('sends a message via POST /conversations/:id/messages', async () => {
    const sentMessage = {
      id: 'msg-3',
      senderId: 'user-1',
      content: 'Nouvelle réponse',
      read: false,
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: SAMPLE_CONVERSATIONS })
      if (url === '/messages/conversation/conv-1') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: {} })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: sentMessage })

    renderMessages()

    await waitFor(() => {
      screen.getByText('prof@test.com')
    })

    await userEvent.click(screen.getByText('prof@test.com'))

    await waitFor(() => {
      screen.getByPlaceholderText('Votre message…')
    })

    await userEvent.type(screen.getByPlaceholderText('Votre message…'), 'Nouvelle réponse')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/conversations/conv-1/messages',
        { content: 'Nouvelle réponse' },
      )
    })
  })

  it('displays the sent message in the thread after sending', async () => {
    const sentMessage = {
      id: 'msg-3',
      senderId: 'user-1',
      content: 'Réponse envoyée avec succès',
      read: false,
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: SAMPLE_CONVERSATIONS })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: {} })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: sentMessage })

    renderMessages()

    await waitFor(() => {
      screen.getByText('prof@test.com')
    })

    await userEvent.click(screen.getByText('prof@test.com'))

    await waitFor(() => {
      screen.getByPlaceholderText('Votre message…')
    })

    await userEvent.type(screen.getByPlaceholderText('Votre message…'), 'Réponse envoyée avec succès')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      // The sent message should appear in the thread
      const matches = screen.getAllByText('Réponse envoyée avec succès')
      // One match = in the message thread (not the input, which is cleared after send)
      expect(matches.length).toBeGreaterThan(0)
    })
  })

  // Spec 4 — Phase 8: si l'envoi retourne 413, afficher un message d'erreur d'attachement
  it('message send supports text and small attachment error state — shows 413 attachment error', async () => {
    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: SAMPLE_CONVERSATIONS })
      if (url === '/messages/conversation/conv-1') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.patch = vi.fn().mockResolvedValue({ data: {} })
    mockApiClient.post = vi.fn().mockRejectedValue({ response: { status: 413 } })

    renderMessages()

    await waitFor(() => {
      screen.getByText('prof@test.com')
    })

    await userEvent.click(screen.getByText('prof@test.com'))

    await waitFor(() => {
      screen.getByPlaceholderText('Votre message…')
    })

    await userEvent.type(screen.getByPlaceholderText('Votre message…'), 'Message avec pièce jointe')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      expect(screen.getByText(/pièce jointe est trop volumineuse/i)).toBeDefined()
    })
  })

  it('creates a new conversation via POST /conversations', async () => {
    const newConversation = {
      id: 'conv-new',
      participantEmail: 'contact@test.com',
      unreadCount: 0,
    }

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: [] })
      if (url === '/messages/conversation/conv-new') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newConversation })

    renderMessages()

    await waitFor(() => {
      screen.getByText('Aucune conversation')
    })

    await userEvent.click(screen.getByRole('button', { name: /nouvelle conversation/i }))

    await waitFor(() => {
      screen.getByPlaceholderText(/uuid du contact autorisé/i)
    })

    await userEvent.type(screen.getByPlaceholderText(/uuid du contact autorisé/i), 'contact-uuid-123')
    await userEvent.click(screen.getByRole('button', { name: /démarrer la conversation/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/conversations', {
        participantId: 'contact-uuid-123',
      })
    })
  })
})
