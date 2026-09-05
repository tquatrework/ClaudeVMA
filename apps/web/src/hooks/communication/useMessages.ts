import { useCallback, useState } from 'react'
import {
  createConversation,
  fetchConversationMessages,
  fetchConversations,
  markMessageAsRead,
  sendMessage as sendMessageRequest,
} from '../../api/communication'
import type { Conversation, Message } from '../../api/communication'
import { fetchContacts } from '../../api/contacts'
import type { Contact } from '../../api/contacts'
import { formatContactDisplayName } from './useContacts'
import { useAsyncData } from '../useAsyncData'
import { getErrorMessage, getErrorStatus } from '../../utils/apiError'

/**
 * Le chargement historique de MessagesPage affiche toujours le même message d'erreur
 * ("Impossible de charger les messages"), quel que soit le statut HTTP — on l'enveloppe
 * ici sous la forme reconnue en priorité par `getErrorMessage` (response.data.message)
 * pour que `useAsyncData` restitue ce message tel quel.
 *
 * Charge conversations ET contacts actifs en parallèle : une conversation ne porte que
 * des `participantIds` (jamais de nom, docs/routes.md § communication-service), le nom
 * affiché de l'interlocuteur est résolu ici depuis la liste des contacts actifs — jamais
 * un UUID affiché à l'écran.
 */
async function loadConversationsAndContacts(): Promise<{
  conversations: Conversation[]
  contacts: Contact[]
}> {
  try {
    const [conversations, contacts] = await Promise.all([fetchConversations(), fetchContacts()])
    return { conversations, contacts }
  } catch {
    throw { response: { data: { message: 'Impossible de charger les messages' } } }
  }
}

export interface UseMessagesResult {
  conversations: Conversation[]
  isLoadingConversations: boolean
  conversationsError: string | null

  /** Nom affichable d'un participant (jamais un UUID) ; repli explicite si inconnu. */
  displayNameFor: (userId: string) => string

  selectedConversationId: string | null
  messages: Message[]
  conversationError: string | null
  selectConversation: (conversationId: string) => Promise<void>

  sendMessage: (content: string) => Promise<boolean>
  isSending: boolean
  sendError: string | null

  /**
   * Ouvre la conversation existante avec `counterpartId` si elle existe déjà, sinon en
   * crée une nouvelle (contact actif requis côté serveur — un contact rompu ou en
   * attente échoue avec un message explicite).
   */
  startConversationWith: (counterpartId: string) => Promise<void>
  isStartingConversation: boolean
  startConversationError: string | null
}

/**
 * useMessages — orchestration complète de MessagesPage : liste des conversations
 * (avec noms résolus), fil de messages de la conversation sélectionnée (avec marquage
 * automatique comme lu), envoi de message et démarrage d'une conversation depuis un
 * contact actif.
 */
export function useMessages(currentUserId: string | undefined): UseMessagesResult {
  const { data, isLoading: isLoadingConversations, error: conversationsError } = useAsyncData(
    loadConversationsAndContacts,
    [],
    { fallbackErrorMessage: 'Impossible de charger les messages' },
  )

  const [conversationsOverride, setConversationsOverride] = useState<Conversation[] | null>(null)
  const conversations = conversationsOverride ?? data?.conversations ?? []
  const contacts = data?.contacts ?? []

  const displayNameFor = useCallback(
    (userId: string): string => {
      const contact = contacts.find((candidate) => candidate.counterpartId === userId)
      return contact ? formatContactDisplayName(contact) : 'Contact'
    },
    [contacts],
  )

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

        const unreadMessages = messageList.filter(
          (message) => !message.isRead && message.senderId !== currentUserId,
        )
        if (unreadMessages.length > 0) {
          await Promise.allSettled(unreadMessages.map((message) => markMessageAsRead(message.id)))
          setMessages((previous) =>
            previous.map((message) =>
              unreadMessages.some((unread) => unread.id === message.id)
                ? { ...message, isRead: true }
                : message,
            ),
          )
        }
      } catch (caughtError: unknown) {
        setConversationError(getErrorMessage(caughtError, 'Impossible de charger la conversation'))
      }
    },
    [currentUserId],
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
          (previous ?? data?.conversations ?? []).map((conversation) =>
            conversation.id === selectedConversationId
              ? { ...conversation, updatedAt: sentMessage.sentAt }
              : conversation,
          ),
        )
        return true
      } catch (caughtError: unknown) {
        // 413 = pièce jointe/contenu trop volumineux — message dédié préservé tel quel.
        // Un contact rompu depuis la création de la conversation répond 403 avec un
        // message métier explicite déjà en français, affiché tel quel.
        setSendError(
          getErrorStatus(caughtError) === 413
            ? 'La pièce jointe est trop volumineuse (413)'
            : getErrorMessage(caughtError, "Erreur lors de l'envoi du message"),
        )
        return false
      } finally {
        setIsSending(false)
      }
    },
    [selectedConversationId, data],
  )

  const [isStartingConversation, setIsStartingConversation] = useState(false)
  const [startConversationError, setStartConversationError] = useState<string | null>(null)

  const startConversationWith = useCallback(
    async (counterpartId: string): Promise<void> => {
      setIsStartingConversation(true)
      setStartConversationError(null)
      try {
        const existing = (conversationsOverride ?? data?.conversations ?? []).find(
          (conversation) =>
            !conversation.isIncident && conversation.participantIds.includes(counterpartId),
        )
        if (existing) {
          await selectConversation(existing.id)
          return
        }

        const created = await createConversation({ participantIds: [counterpartId] })
        setConversationsOverride((previous) => [created, ...(previous ?? data?.conversations ?? [])])
        await selectConversation(created.id)
      } catch (caughtError: unknown) {
        setStartConversationError(
          getErrorMessage(caughtError, 'Impossible de démarrer la conversation'),
        )
      } finally {
        setIsStartingConversation(false)
      }
    },
    [conversationsOverride, data, selectConversation],
  )

  return {
    conversations,
    isLoadingConversations,
    conversationsError,
    displayNameFor,
    selectedConversationId,
    messages,
    conversationError,
    selectConversation,
    sendMessage,
    isSending,
    sendError,
    startConversationWith,
    isStartingConversation,
    startConversationError,
  }
}
