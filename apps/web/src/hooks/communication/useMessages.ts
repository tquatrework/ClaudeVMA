import { useCallback, useState } from 'react'
import {
  createConversation,
  fetchConversationMessages,
  fetchConversations,
  markMessageAsRead,
  sendMessage as sendMessageRequest,
} from '../../api/communication'
import type { Conversation, Message } from '../../api/communication'
import { useAsyncData } from '../useAsyncData'
import { getErrorStatus } from '../../utils/apiError'

/**
 * Le chargement historique de MessagesPage affiche toujours le même message d'erreur
 * ("Impossible de charger les messages"), quel que soit le statut HTTP — on l'enveloppe
 * ici sous la forme reconnue en priorité par `getErrorMessage` (response.data.message)
 * pour que `useAsyncData` restitue ce message tel quel.
 */
async function loadConversations(): Promise<Conversation[]> {
  try {
    return await fetchConversations()
  } catch {
    throw { response: { data: { message: 'Impossible de charger les messages' } } }
  }
}

export interface UseMessagesResult {
  conversations: Conversation[]
  isLoadingConversations: boolean
  conversationsError: string | null

  selectedConversationId: string | null
  messages: Message[]
  conversationError: string | null
  selectConversation: (conversationId: string) => Promise<void>

  sendMessage: (content: string) => Promise<boolean>
  isSending: boolean
  sendError: string | null

  createConversation: (participantId: string) => Promise<Conversation | null>
  isCreatingConversation: boolean
  createConversationError: string | null
}

/**
 * useMessages — orchestration complète de MessagesPage : liste des conversations, fil de
 * messages de la conversation sélectionnée (avec marquage automatique comme lu), envoi de
 * message et création de conversation.
 */
export function useMessages(): UseMessagesResult {
  const {
    data,
    isLoading: isLoadingConversations,
    error: conversationsError,
  } = useAsyncData(loadConversations, [], {
    fallbackErrorMessage: 'Impossible de charger les messages',
  })

  const [conversationsOverride, setConversationsOverride] = useState<Conversation[] | null>(null)
  const conversations = conversationsOverride ?? data ?? []

  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationError, setConversationError] = useState<string | null>(null)

  const selectConversation = useCallback(
    async (conversationId: string) => {
      setSelectedConversationId(conversationId)
      setConversationError(null)
      try {
        const messageList = await fetchConversationMessages(conversationId)
        setMessages(messageList)

        const unreadMessages = messageList.filter((message) => !message.read)
        if (unreadMessages.length > 0) {
          await Promise.allSettled(unreadMessages.map((message) => markMessageAsRead(message.id)))
          setMessages((previous) => previous.map((message) => ({ ...message, read: true })))
          setConversationsOverride((previous) =>
            (previous ?? data ?? []).map((conversation) =>
              conversation.id === conversationId
                ? { ...conversation, unreadCount: 0 }
                : conversation,
            ),
          )
        }
      } catch {
        setConversationError('Impossible de charger la conversation')
      }
    },
    [data],
  )

  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)

  const sendMessage = useCallback(
    async (content: string): Promise<boolean> => {
      if (!selectedConversationId || !content.trim()) return false
      setIsSending(true)
      setSendError(null)
      try {
        const sentMessage = await sendMessageRequest(selectedConversationId, {
          content: content.trim(),
        })
        setMessages((previous) => [...previous, sentMessage])
        setConversationsOverride((previous) =>
          (previous ?? data ?? []).map((conversation) =>
            conversation.id === selectedConversationId
              ? { ...conversation, lastMessage: content.trim() }
              : conversation,
          ),
        )
        return true
      } catch (caughtError: unknown) {
        // 413 = pièce jointe/contenu trop volumineux — message dédié préservé tel quel.
        setSendError(
          getErrorStatus(caughtError) === 413
            ? 'La pièce jointe est trop volumineuse (413)'
            : "Erreur lors de l'envoi du message",
        )
        return false
      } finally {
        setIsSending(false)
      }
    },
    [selectedConversationId, data],
  )

  const [isCreatingConversation, setIsCreatingConversation] = useState(false)
  const [createConversationError, setCreateConversationError] = useState<string | null>(null)

  const createNewConversation = useCallback(
    async (participantId: string): Promise<Conversation | null> => {
      if (!participantId.trim()) return null
      setIsCreatingConversation(true)
      setCreateConversationError(null)
      try {
        const conversation = await createConversation({ participantId: participantId.trim() })
        setConversationsOverride((previous) => [conversation, ...(previous ?? data ?? [])])
        await selectConversation(conversation.id)
        return conversation
      } catch (caughtError: unknown) {
        const message =
          (caughtError as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? 'Impossible de créer la conversation'
        setCreateConversationError(message)
        return null
      } finally {
        setIsCreatingConversation(false)
      }
    },
    [data, selectConversation],
  )

  return {
    conversations,
    isLoadingConversations,
    conversationsError,
    selectedConversationId,
    messages,
    conversationError,
    selectConversation,
    sendMessage,
    isSending,
    sendError,
    createConversation: createNewConversation,
    isCreatingConversation,
    createConversationError,
  }
}
