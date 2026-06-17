import React, { useEffect, useState, useRef } from 'react'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface Message {
  id: string
  senderId: string
  content: string
  read: boolean
  createdAt: string
}

interface Conversation {
  id: string
  participantId?: string
  participantEmail?: string
  lastMessage?: string
  unreadCount: number
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessageContent, setNewMessageContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create conversation state
  const [isCreatingConv, setIsCreatingConv] = useState(false)
  const [newConvParticipantId, setNewConvParticipantId] = useState('')
  const [isCreatingConvLoading, setIsCreatingConvLoading] = useState(false)
  const [createConvError, setCreateConvError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    apiClient
      .get<Conversation[]>('/conversations')
      .then(({ data }) => setConversations(Array.isArray(data) ? data : []))
      .catch(() => setError('Impossible de charger les messages'))
      .finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversation = async (convId: string) => {
    setSelectedConvId(convId)
    setError(null)
    try {
      const { data } = await apiClient.get<Message[]>(`/messages/conversation/${convId}`)
      const messageList = Array.isArray(data) ? data : []
      setMessages(messageList)

      // Mark unread messages as read
      const unreadMessages = messageList.filter((m) => !m.read)
      if (unreadMessages.length > 0) {
        await Promise.allSettled(
          unreadMessages.map((m) => apiClient.patch(`/messages/${m.id}/read`)),
        )
        setMessages((prev) => prev.map((m) => ({ ...m, read: true })))
        setConversations((prev) =>
          prev.map((conv) =>
            conv.id === convId ? { ...conv, unreadCount: 0 } : conv,
          ),
        )
      }
    } catch {
      setError('Impossible de charger la conversation')
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConvId || !newMessageContent.trim()) return
    setIsSending(true)
    try {
      const { data } = await apiClient.post<Message>(
        `/conversations/${selectedConvId}/messages`,
        { content: newMessageContent.trim() },
      )
      setMessages((prev) => [...prev, data])
      setNewMessageContent('')
      // Update last message in conversations list
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === selectedConvId
            ? { ...conv, lastMessage: newMessageContent.trim() }
            : conv,
        ),
      )
    } catch (err: unknown) {
      const httpStatus =
        (err as { response?: { status?: number } })?.response?.status
      if (httpStatus === 413) {
        setError('La pièce jointe est trop volumineuse (413)')
      } else {
        setError("Erreur lors de l'envoi du message")
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleCreateConversation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newConvParticipantId.trim()) return
    setIsCreatingConvLoading(true)
    setCreateConvError(null)
    try {
      const { data } = await apiClient.post<Conversation>('/conversations', {
        participantId: newConvParticipantId.trim(),
      })
      setConversations((prev) => [data, ...prev])
      setNewConvParticipantId('')
      setIsCreatingConv(false)
      // Auto-select new conversation
      await loadConversation(data.id)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Impossible de créer la conversation'
      setCreateConvError(message)
    } finally {
      setIsCreatingConvLoading(false)
    }
  }

  const selectedConversation = conversations.find((conv) => conv.id === selectedConvId)

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

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">✕</button>
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
            {createConvError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {createConvError}
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
                disabled={isCreatingConvLoading || !newConvParticipantId.trim()}
                className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {isCreatingConvLoading ? 'Création…' : 'Démarrer la conversation'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingConv(false)
                  setNewConvParticipantId('')
                  setCreateConvError(null)
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
              {isLoading && <p className="p-4 text-gray-400 text-sm">Chargement…</p>}
              {!isLoading && conversations.length === 0 && (
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
                  onClick={() => loadConversation(conv.id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    selectedConvId === conv.id ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : ''
                  }`}
                >
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {conv.participantEmail ?? (conv.participantId ? `${conv.participantId.slice(0, 10)}…` : 'Conversation')}
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
            {!selectedConvId ? (
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
