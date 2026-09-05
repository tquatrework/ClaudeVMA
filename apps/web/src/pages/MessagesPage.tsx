/**
 * MessagesPage — messagerie entre contacts actifs.
 * Réécrite le 2026-09-05 pour la refonte Contacts (docs/architecture/contacts-messagerie.md,
 * 2026-09-04) : plus de saisie libre d'un UUID de participant — une conversation démarre
 * toujours depuis un contact actif (bouton "Écrire" de ContactsPage/ImportantContacts, via
 * `location.state`), et la messagerie échoue clairement (message serveur affiché tel quel)
 * si le contact a été rompu depuis.
 */

import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useMessages } from '../hooks/communication/useMessages'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { EmptyState } from '../components/ui/EmptyState'

interface LocationState {
  startConversationWithUserId?: string
  startConversationWithLabel?: string
}

export default function MessagesPage() {
  const location = useLocation()
  const locationState = (location.state ?? {}) as LocationState
  const { user } = useAuth()

  const {
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
  } = useMessages(user?.id)

  const [newMessageContent, setNewMessageContent] = useState('')
  const [isErrorDismissed, setIsErrorDismissed] = useState(false)
  const [hasHandledInitialContact, setHasHandledInitialContact] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const error = conversationsError ?? conversationError ?? sendError ?? startConversationError

  // Arrivée depuis "Écrire" (ContactsPage / ImportantContacts) : ouvre ou crée la
  // conversation avec ce contact, une seule fois par navigation.
  useEffect(() => {
    if (hasHandledInitialContact) return
    if (isLoadingConversations) return
    if (!locationState.startConversationWithUserId) {
      setHasHandledInitialContact(true)
      return
    }
    setHasHandledInitialContact(true)
    void startConversationWith(locationState.startConversationWithUserId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoadingConversations, hasHandledInitialContact])

  useEffect(() => {
    setIsErrorDismissed(false)
  }, [error])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const sent = await sendMessage(newMessageContent)
    if (sent) setNewMessageContent('')
  }

  const otherParticipantOf = (participantIds: string[]): string | undefined =>
    participantIds.find((id) => id !== user?.id)

  const conversationLabel = (participantIds: string[]): string => {
    const otherId = otherParticipantOf(participantIds)
    return otherId ? displayNameFor(otherId) : 'Conversation'
  }

  const selectedConversation = conversations.find((conv) => conv.id === selectedConversationId)

  return (
    <Layout>
      <div className="max-w-4xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Messagerie</h1>
          <p className="mt-1 text-sm text-gray-500">
            Écrivez à vos contacts actifs. Pour démarrer une nouvelle conversation, utilisez le
            bouton « Écrire » depuis la fiche d'un contact.
          </p>
        </div>

        {error && !isErrorDismissed && (
          <ErrorMessage message={error} onClose={() => setIsErrorDismissed(true)} className="mb-4" />
        )}

        {locationState.startConversationWithLabel && isStartingConversation && (
          <p className="mb-4 text-sm text-gray-400">
            Ouverture de la conversation avec {locationState.startConversationWithLabel}…
          </p>
        )}

        <div className="flex gap-4 h-[580px]">
          {/* Conversation list */}
          <aside className="w-64 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="p-3 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Conversations
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingConversations && <p className="p-4 text-gray-400 text-sm">Chargement…</p>}
              {!isLoadingConversations && conversations.length === 0 && (
                <div className="p-4">
                  <EmptyState
                    message="Aucune conversation. Écrivez à un contact depuis la page Contacts."
                    actionLabel="Voir mes contacts"
                    actionPath="/contacts"
                  />
                </div>
              )}
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedConversationId === conv.id
                      ? 'bg-indigo-50 border-l-2 border-l-indigo-500'
                      : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {conv.isIncident ? 'Incident TI' : conversationLabel(conv.participantIds)}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          {/* Message thread */}
          <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden">
            {!selectedConversationId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                <span>Sélectionnez une conversation</span>
              </div>
            ) : (
              <>
                {/* Thread header */}
                {selectedConversation && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-800">
                      {selectedConversation.isIncident
                        ? 'Incident TI'
                        : conversationLabel(selectedConversation.participantIds)}
                    </p>
                  </div>
                )}

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.length === 0 && (
                    <p className="text-center text-gray-400 text-sm mt-8">
                      Aucun message dans cette conversation
                    </p>
                  )}
                  {messages.map((m) => {
                    const isOwnMessage = m.senderId === user?.id
                    return (
                      <div
                        key={m.id}
                        className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`rounded-lg px-3 py-2 text-sm max-w-sm ${
                            isOwnMessage
                              ? 'bg-indigo-600 text-white'
                              : m.isRead
                                ? 'bg-gray-100 text-gray-800'
                                : 'bg-indigo-100 text-gray-900 font-medium'
                          }`}
                        >
                          {m.content}
                        </div>
                        <span className="text-xs text-gray-400 mt-0.5">
                          {new Date(m.sentAt).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    )
                  })}
                  <div ref={messagesEndRef} />
                </div>

                {/* Send message form */}
                <form
                  onSubmit={handleSendMessage}
                  className="border-t border-gray-200 p-3 flex gap-2"
                >
                  <input
                    type="text"
                    value={newMessageContent}
                    onChange={(e) => setNewMessageContent(e.target.value)}
                    placeholder="Votre message…"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !newMessageContent.trim()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSending ? '…' : 'Envoyer'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
