/**
 * Tests for MessagesPage
 *
 * Covers:
 * - Conversation list loading via fetchConversations (src/api/communication)
 * - Empty state when no conversations
 * - Selecting a conversation loads messages via fetchConversationMessages
 * - Unread messages are marked read (markMessageAsRead)
 * - Sending a message calls sendMessage
 * - Creating a new conversation calls createConversation
 * - Error state when conversations fail to load
 *
 * La page consomme désormais `useMessages` (src/hooks/communication/useMessages), qui
 * s'appuie sur `src/api/communication` — mocké ci-dessous, plus d'appel direct à
 * `apiClient` dans cette page.
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MessagesPage from '../../src/pages/MessagesPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/communication')

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchConversations,
  fetchConversationMessages,
  markMessageAsRead,
  sendMessage,
  createConversation,
} from '../../src/api/communication'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchConversations = vi.mocked(fetchConversations)
const mockFetchConversationMessages = vi.mocked(fetchConversationMessages)
const mockMarkMessageAsRead = vi.mocked(markMessageAsRead)
const mockSendMessage = vi.mocked(sendMessage)
const mockCreateConversation = vi.mocked(createConversation)

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
  { id: 'conv-2', participantEmail: 'parent@test.com', unreadCount: 0 },
]

const SAMPLE_MESSAGES = [
  { id: 'msg-1', senderId: 'prof-1', content: 'Bonjour !', read: false, createdAt: new Date().toISOString() },
  { id: 'msg-2', senderId: 'user-1', content: 'Merci !', read: true, createdAt: new Date().toISOString() },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(AUTH_USER)
  mockMarkMessageAsRead.mockResolvedValue(undefined)
})

describe('MessagesPage', () => {
  it('shows loading indicator while fetching conversations', () => {
    mockFetchConversations.mockReturnValue(new Promise(() => {}))

    renderMessages()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders conversation list', async () => {
    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText('prof@test.com')).toBeDefined()
      expect(screen.getByText('parent@test.com')).toBeDefined()
    })
  })

  it('shows empty state when no conversations exist', async () => {
    mockFetchConversations.mockResolvedValue([])

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText('Aucune conversation')).toBeDefined()
    })
  })

  it('shows error when conversations fail to load', async () => {
    mockFetchConversations.mockRejectedValue({ response: { status: 500 } })

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les messages')).toBeDefined()
    })
  })

  it('shows unread count badge for conversations with unread messages', async () => {
    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)

    renderMessages()

    await waitFor(() => {
      // conv-1 has unreadCount: 2
      expect(screen.getByText('2')).toBeDefined()
    })
  })

  it('loads messages when a conversation is selected', async () => {
    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)
    mockFetchConversationMessages.mockImplementation((conversationId: string) =>
      conversationId === 'conv-1' ? Promise.resolve(SAMPLE_MESSAGES) : Promise.resolve([]),
    )

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

  it('calls markMessageAsRead for unread messages when opening a conversation', async () => {
    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)
    mockFetchConversationMessages.mockImplementation((conversationId: string) =>
      conversationId === 'conv-1' ? Promise.resolve(SAMPLE_MESSAGES) : Promise.resolve([]),
    )

    renderMessages()

    await waitFor(() => {
      screen.getByText('prof@test.com')
    })

    await userEvent.click(screen.getByText('prof@test.com'))

    await waitFor(() => {
      // msg-1 is unread — should trigger a read call
      expect(mockMarkMessageAsRead).toHaveBeenCalledWith('msg-1')
    })
  })

  it('sends a message via sendMessage(conversationId, payload)', async () => {
    const sentMessage = {
      id: 'msg-3',
      senderId: 'user-1',
      content: 'Nouvelle réponse',
      read: false,
      createdAt: new Date().toISOString(),
    }

    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)
    mockFetchConversationMessages.mockResolvedValue([])
    mockSendMessage.mockResolvedValue(sentMessage)

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
      expect(mockSendMessage).toHaveBeenCalledWith('conv-1', { content: 'Nouvelle réponse' })
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

    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)
    mockFetchConversationMessages.mockResolvedValue([])
    mockSendMessage.mockResolvedValue(sentMessage)

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
    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)
    mockFetchConversationMessages.mockResolvedValue([])
    mockSendMessage.mockRejectedValue({ response: { status: 413 } })

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

  it('creates a new conversation via createConversation', async () => {
    const newConversation = {
      id: 'conv-new',
      participantEmail: 'contact@test.com',
      unreadCount: 0,
    }

    mockFetchConversations.mockResolvedValue([])
    mockFetchConversationMessages.mockResolvedValue([])
    mockCreateConversation.mockResolvedValue(newConversation)

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
      expect(mockCreateConversation).toHaveBeenCalledWith({ participantId: 'contact-uuid-123' })
    })
  })
})
