import React, { useEffect, useState } from 'react'
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
  participantId: string
  participantEmail?: string
  lastMessage?: string
  unreadCount: number
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConv, setSelectedConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load conversations list — placeholder using a generic messages endpoint
    // In phase 1 the actual conversations list endpoint may vary
    apiClient
      .get<Conversation[]>('/conversations')
      .then(({ data }) => setConversations(data))
      .catch(() => setError('Impossible de charger les messages'))
      .finally(() => setIsLoading(false))
  }, [])

  const loadConversation = async (convId: string) => {
    setSelectedConv(convId)
    try {
      const { data } = await apiClient.get<Message[]>(`/messages/conversation/${convId}`)
      setMessages(data)
      // Mark all as read
      await Promise.allSettled(
        data.filter((m) => !m.read).map((m) => apiClient.patch(`/messages/${m.id}/read`)),
      )
    } catch {
      setError('Impossible de charger la conversation')
    }
  }

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConv || !newMessage.trim()) return
    setIsSending(true)
    try {
      const { data } = await apiClient.post<Message>(`/conversations/${selectedConv}/messages`, {
        content: newMessage.trim(),
      })
      setMessages((prev) => [...prev, data])
      setNewMessage('')
    } catch {
      setError('Erreur lors de l\'envoi')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-4xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Messagerie</h1>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-6 h-[600px]">
          {/* Conversation list */}
          <aside className="w-64 bg-white border border-gray-200 rounded-xl overflow-y-auto">
            {isLoading && <p className="p-4 text-gray-400 text-sm">Chargement…</p>}
            {!isLoading && conversations.length === 0 && (
              <p className="p-4 text-gray-400 text-sm">Aucune conversation</p>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv.id)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                  selectedConv === conv.id ? 'bg-indigo-50' : ''
                }`}
              >
                <p className="text-sm font-medium text-gray-800">
                  {conv.participantEmail ?? conv.participantId.slice(0, 8)}
                </p>
                {conv.lastMessage && (
                  <p className="text-xs text-gray-500 truncate">{conv.lastMessage}</p>
                )}
                {conv.unreadCount > 0 && (
                  <span className="mt-1 inline-block text-xs bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                    {conv.unreadCount}
                  </span>
                )}
              </button>
            ))}
          </aside>

          {/* Message thread */}
          <div className="flex-1 flex flex-col bg-white border border-gray-200 rounded-xl overflow-hidden">
            {!selectedConv ? (
              <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                Sélectionnez une conversation
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((m) => (
                    <div key={m.id} className="flex flex-col">
                      <div className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-800 max-w-xs">
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
                </div>

                <form onSubmit={sendMessage} className="border-t border-gray-200 p-3 flex gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Votre message…"
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  />
                  <button
                    type="submit"
                    disabled={isSending || !newMessage.trim()}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                  >
                    Envoyer
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
