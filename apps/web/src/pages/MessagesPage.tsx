import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '../components/Layout'
import { useMessages } from '../hooks/communication/useMessages'

interface LocationState {
  initialContactId?: string
  initialContactLabel?: string
}

export default function MessagesPage() {
  const location = useLocation()
  const locationState = (location.state ?? {}) as LocationState

  const {
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
    createConversation,
    isCreatingConversation,
    createConversationError,
  } = useMessages()

  const [newMessageContent, setNewMessageContent] = useState('')
  const [isCreatingConv, setIsCreatingConv] = useState(!!locationState.initialContactId)
  const [newConvParticipantId, setNewConvParticipantId] = useState(
    locationState.initialContactId ?? '',
  )
  const [isErrorDismissed, setIsErrorDismissed] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const error = conversationsError ?? conversationError ?? sendError

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

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault()
    const conversation = await createConversation(newConvParticipantId)
    if (conversation) {
      setNewConvParticipantId('')
      setIsCreatingConv(false)
    }
  }

  const selectedConversation = conversations.find((conv) => conv.id === selectedConversationId)

  return (
    <Layout>
      <div className="max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Messagerie</h1>
          <button
            onClick={() => setIsCreatingConv(!isCreatingConv)}
            className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
          >
            {isCreatingConv ? 'Annuler' : 'Nouvelle conversation'}
          </button>
        </div>

        {error && !isErrorDismissed && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setIsErrorDismissed(true)}
              className="text-red-400 hover:text-red-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {/* Create conversation panel */}
        {isCreatingConv && (
          <form
            onSubmit={handleCreateConversation}
            className="mb-5 bg-white border border-gray-200 rounded-xl p-5 space-y-3 shadow-sm"
          >
            <h2 className="text-sm font-semibold text-gray-800">Nouvelle conversation</h2>
            <p className="text-xs text-gray-500">
              Vous pouvez uniquement démarrer une conversation avec un contact autorisé.
            </p>
            {locationState.initialContactLabel && (
              <p className="text-xs text-indigo-700 font-medium">
                Contact sélectionné : {locationState.initialContactLabel}
              </p>
            )}
            {createConversationError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {createConversationError}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ID du participant <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={newConvParticipantId}
                onChange={(e) => setNewConvParticipantId(e.target.value)}
                placeholder="UUID du contact autorisé"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isCreatingConversation || !newConvParticipantId.trim()}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {isCreatingConversation ? 'Création…' : 'Démarrer la conversation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingConv(false)
                  setNewConvParticipantId('')
                }}
                className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
              >
                Annuler
              </button>
            </div>
          </form>
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
                <div className="p-4 text-center">
                  <p className="text-gray-400 text-sm">Aucune conversation</p>
                  <button
                    onClick={() => setIsCreatingConv(true)}
                    className="mt-2 text-xs text-indigo-600 hover:underline"
                  >
                    En créer une
                  </button>
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
                    {conv.participantEmail ??
                      (conv.participantId ? `${conv.participantId.slice(0, 10)}…` : 'Conversation')}
                  </p>
                  {conv.lastMessage && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{conv.lastMessage}</p>
                  )}
                  {conv.unreadCount > 0 && (
                    <span className="mt-1 inline-block text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                      {conv.unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </aside>

          {/* Message thread */}
          <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden">
            {!selectedConversationId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400 text-sm gap-2">
                <span>Sélectionnez une conversation</span>
                <span className="text-xs text-gray-300">ou créez-en une nouvelle</span>
              </div>
            ) : (
              <>
                {/* Thread header */}
                {selectedConversation && (
                  <div className="px-4 py-3 border-b border-gray-100">
                    <p className="text-sm font-medium text-gray-800">
                      {selectedConversation.participantEmail ??
                        (selectedConversation.participantId
                          ? `${selectedConversation.participantId.slice(0, 12)}…`
                          : 'Conversation')}
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
                  {messages.map((m) => (
                    <div key={m.id} className="flex flex-col items-start">
                      <div
                        className={`rounded-lg px-3 py-2 text-sm max-w-sm ${
                          m.read ? 'bg-gray-100 text-gray-800' : 'bg-indigo-100 text-gray-900 font-medium'
                        }`}
                      >
                        {m.content}
                      </div>
                      <span className="text-xs text-gray-400 mt-0.5">
                        {new Date(m.createdAt).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  ))}
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
