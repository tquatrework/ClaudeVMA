import React, { useEffect, useState } from 'react'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface Memo {
  id: string
  title?: string
  content: string
  createdAt: string
}

export default function MemosPage() {
  const [memos, setMemos] = useState<Memo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Edit state
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null)

  // Detail view state
  const [selectedMemo, setSelectedMemo] = useState<Memo | null>(null)

  useEffect(() => {
    apiClient
      .get<Memo[]>('/memos')
      .then(({ data }) => setMemos(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else setError('Impossible de charger les mémos')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newContent.trim()) return
    setIsSaving(true)
    setError(null)
    try {
      const { data } = await apiClient.post<Memo>('/memos', {
        title: newTitle.trim() || undefined,
        content: newContent.trim(),
      })
      setMemos((prev) => [data, ...prev])
      setNewTitle('')
      setNewContent('')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la création du mémo'
      setError(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (memoId: string) => {
    setError(null)
    try {
      await apiClient.delete(`/memos/${memoId}`)
      setMemos((prev) => prev.filter((m) => m.id !== memoId))
      if (selectedMemo?.id === memoId) {
        setSelectedMemo(null)
      }
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la suppression'
      setError(message)
    }
  }

  const handleOpenDetail = async (memoId: string) => {
    setEditingMemoId(null)
    try {
      const { data } = await apiClient.get<Memo>(`/memos/${memoId}`)
      setSelectedMemo(data)
    } catch {
      setError('Impossible de charger le mémo')
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Mémos</h1>
          <p className="text-sm text-gray-500 mt-1">Notes personnelles ou pédagogiques</p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-3">
              ✕
            </button>
          </div>
        )}

        {/* Create memo form */}
        <form
          onSubmit={handleCreate}
          className="mb-6 bg-white border border-gray-200 rounded-xl p-5 space-y-3 shadow-sm"
        >
          <h2 className="text-sm font-semibold text-gray-800">Nouveau mémo</h2>
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Titre (optionnel)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <textarea
            required
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Contenu du mémo…"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <button
            type="submit"
            disabled={isSaving || !newContent.trim()}
            className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSaving ? 'Ajout…' : 'Ajouter'}
          </button>
        </form>

        {/* Detail panel */}
        {selectedMemo && editingMemoId !== selectedMemo.id && (
          <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                {selectedMemo.title && (
                  <p className="text-sm font-semibold text-gray-800">{selectedMemo.title}</p>
                )}
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(selectedMemo.createdAt).toLocaleString('fr-FR')}
                </p>
              </div>
              <button
                onClick={() => setSelectedMemo(null)}
                className="text-gray-400 hover:text-gray-600 text-sm"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{selectedMemo.content}</p>
          </div>
        )}

        {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

        {!isLoading && memos.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
            <p className="text-gray-400 text-sm">Aucun mémo pour l'instant</p>
            <p className="text-xs text-gray-400 mt-1">Utilisez le formulaire ci-dessus pour créer votre premier mémo.</p>
          </div>
        )}

        <ul className="space-y-3">
          {memos.map((memo) => (
            <li
              key={memo.id}
              className={`bg-white border rounded-xl p-4 transition-all ${
                selectedMemo?.id === memo.id
                  ? 'border-indigo-300 shadow-sm'
                  : 'border-gray-200 hover:border-indigo-200'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => handleOpenDetail(memo.id)}
                  className="flex-1 text-left min-w-0"
                >
                  {memo.title && (
                    <p className="text-sm font-medium text-gray-800 truncate">{memo.title}</p>
                  )}
                  <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">{memo.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(memo.createdAt).toLocaleString('fr-FR')}
                  </p>
                </button>
                <button
                  onClick={() => handleDelete(memo.id)}
                  className="shrink-0 text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                  title="Supprimer ce mémo"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}
