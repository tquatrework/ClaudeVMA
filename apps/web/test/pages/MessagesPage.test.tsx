/**
 * Tests for MessagesPage — refonte Contacts (docs/architecture/contacts-messagerie.md,
 * 2026-09-04). Remplace intégralement l'ancienne suite : plus de saisie libre d'un UUID
 * de participant ("ID du participant"), une conversation démarre toujours depuis un
 * contact actif via `location.state.startConversationWithUserId` (bouton "Écrire").
 *
 * Covers:
 * - Conversation list loading, with names resolved from active contacts (jamais un UUID)
 * - Empty state when no conversations
 * - Error state when conversations fail to load
 * - Selecting a conversation loads messages and marks unread (received) messages as read
 * - Sending a message
 * - 413 attachment error
 * - Arriving with `startConversationWithUserId` opens the existing conversation, or
 *   creates one if none exists yet
 * - A contact broken since conversation creation surfaces the server's French message
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import MessagesPage from '../../src/pages/MessagesPage'

vi.mock('../../src/hooks/useAuth')
vi.mock('../../src/api/communication')
vi.mock('../../src/api/contacts')

import { useAuth } from '../../src/hooks/useAuth'
import {
  fetchConversations,
  fetchConversationMessages,
  markMessageAsRead,
  sendMessage,
  createConversation,
} from '../../src/api/communication'
import { fetchContacts } from '../../src/api/contacts'

const mockUseAuth = vi.mocked(useAuth)
const mockFetchContacts = vi.mocked(fetchContacts)
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

function renderMessages(initialState?: Record<string, unknown>) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/messages', state: initialState }]}>
      <MessagesPage />
    </MemoryRouter>,
  )
}

const CONTACT = {
  id: 'contact-1',
  counterpartId: 'prof-1',
  counterpartName: { firstName: 'Camille', lastName: 'Formateur' },
  status: 'active' as const,
  origin: 'default' as const,
  createdAt: '2026-09-01T00:00:00.000Z',
  brokenAt: null,
}

const SAMPLE_CONVERSATIONS = [
  {
    id: 'conv-1',
    participantIds: ['user-1', 'prof-1'],
    subject: null,
    isIncident: false,
    incidentId: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  },
]

const SAMPLE_MESSAGES = [
  {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'prof-1',
    content: 'Bonjour !',
    attachmentRef: null,
    isSystem: false,
    isRead: false,
    sentAt: new Date().toISOString(),
  },
  {
    id: 'msg-2',
    conversationId: 'conv-1',
    senderId: 'user-1',
    content: 'Merci !',
    attachmentRef: null,
    isSystem: false,
    isRead: true,
    sentAt: new Date().toISOString(),
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(AUTH_USER)
  mockMarkMessageAsRead.mockResolvedValue(undefined)
  mockFetchContacts.mockResolvedValue([CONTACT])
})

describe('MessagesPage', () => {
  it('shows loading indicator while fetching conversations', () => {
    mockFetchConversations.mockReturnValue(new Promise(() => {}))

    renderMessages()

    expect(screen.getByText('Chargement…')).toBeDefined()
  })

  it('renders conversation list with resolved contact names, never a UUID', async () => {
    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText('Camille Formateur')).toBeDefined()
    })
    expect(screen.queryByText('prof-1')).toBeNull()
  })

  it('shows empty state when no conversations exist', async () => {
    mockFetchConversations.mockResolvedValue([])

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText(/aucune conversation/i)).toBeDefined()
    })
  })

  it('shows error when conversations fail to load', async () => {
    mockFetchConversations.mockRejectedValue({ response: { status: 500 } })

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText('Impossible de charger les messages')).toBeDefined()
    })
  })

  it('loads messages when a conversation is selected, marking only received messages as read', async () => {
    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)
    mockFetchConversationMessages.mockResolvedValue(SAMPLE_MESSAGES)

    renderMessages()

    await waitFor(() => {
      expect(screen.getByText('Camille Formateur')).toBeDefined()
    })

    await userEvent.click(screen.getByText('Camille Formateur'))

    await waitFor(() => {
      expect(screen.getByText('Bonjour !')).toBeDefined()
      expect(screen.getByText('Merci !')).toBeDefined()
    })

    // msg-1 (senderId: prof-1, unread) triggers a read call; msg-2 (own message) does not.
    await waitFor(() => {
      expect(mockMarkMessageAsRead).toHaveBeenCalledWith('msg-1')
    })
    expect(mockMarkMessageAsRead).not.toHaveBeenCalledWith('msg-2')
  })

  it('sends a message via sendMessage(conversationId, {content})', async () => {
    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)
    mockFetchConversationMessages.mockResolvedValue([])
    mockSendMessage.mockResolvedValue({
      id: 'msg-3',
      conversationId: 'conv-1',
      senderId: 'user-1',
      content: 'Nouvelle réponse',
      attachmentRef: null,
      isSystem: false,
      isRead: false,
      sentAt: new Date().toISOString(),
    })

    renderMessages()

    await waitFor(() => {
      screen.getByText('Camille Formateur')
    })
    await userEvent.click(screen.getByText('Camille Formateur'))

    await waitFor(() => {
      screen.getByPlaceholderText('Votre message…')
    })

    await userEvent.type(screen.getByPlaceholderText('Votre message…'), 'Nouvelle réponse')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith('conv-1', { content: 'Nouvelle réponse' })
    })
    await waitFor(() => {
      expect(screen.getAllByText('Nouvelle réponse').length).toBeGreaterThan(0)
    })
  })

  it('shows a dedicated error when sending returns 413 (attachment too large)', async () => {
    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)
    mockFetchConversationMessages.mockResolvedValue([])
    mockSendMessage.mockRejectedValue({ response: { status: 413 } })

    renderMessages()

    await waitFor(() => {
      screen.getByText('Camille Formateur')
    })
    await userEvent.click(screen.getByText('Camille Formateur'))

    await waitFor(() => {
      screen.getByPlaceholderText('Votre message…')
    })

    await userEvent.type(screen.getByPlaceholderText('Votre message…'), 'Message avec pièce jointe')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      expect(screen.getByText(/pièce jointe est trop volumineuse/i)).toBeDefined()
    })
  })

  it('opens the existing conversation when arriving via "Écrire" on an already-contacted person', async () => {
    mockFetchConversations.mockResolvedValue(SAMPLE_CONVERSATIONS)
    mockFetchConversationMessages.mockResolvedValue([])

    renderMessages({ startConversationWithUserId: 'prof-1', startConversationWithLabel: 'Camille Formateur' })

    await waitFor(() => {
      expect(mockFetchConversationMessages).toHaveBeenCalledWith('conv-1')
    })
    expect(mockCreateConversation).not.toHaveBeenCalled()
  })

  it('creates a new conversation when arriving via "Écrire" on a person with no conversation yet', async () => {
    const newConversation = {
      id: 'conv-new',
      participantIds: ['user-1', 'prof-1'],
      subject: null,
      isIncident: false,
      incidentId: null,
      createdAt: '2026-09-05T00:00:00.000Z',
      updatedAt: '2026-09-05T00:00:00.000Z',
    }
    mockFetchConversations.mockResolvedValue([])
    mockFetchConversationMessages.mockResolvedValue([])
    mockCreateConversation.mockResolvedValue(newConversation)

    renderMessages({ startConversationWithUserId: 'prof-1', startConversationWithLabel: 'Camille Formateur' })

    await waitFor(() => {
      expect(mockCreateConversation).toHaveBeenCalledWith({ participantIds: ['prof-1'] })
    })
    await waitFor(() => {
      expect(mockFetchConversationMessages).toHaveBeenCalledWith('conv-new')
    })
  })

  it("surfaces the server's French message when the contact was broken since the conversation was created", async () => {
    mockFetchConversations.mockResolvedValue([])
    mockCreateConversation.mockRejectedValue({
      response: {
        status: 403,
        data: { message: 'Vous n\'avez plus de contact actif avec cette personne — la messagerie est fermée' },
      },
    })

    renderMessages({ startConversationWithUserId: 'prof-1', startConversationWithLabel: 'Camille Formateur' })

    await waitFor(() => {
      expect(screen.getByText(/vous n'avez plus de contact actif/i)).toBeDefined()
    })
  })
})
