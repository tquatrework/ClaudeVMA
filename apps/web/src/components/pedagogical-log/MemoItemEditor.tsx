/**
 * MemoItemEditor — formulaire de création d'un mémo.
 * Champs : titre (string), contenu (texte libre ou LaTeX), chapitre optionnel.
 * Élève uniquement — le backend refuse les autres rôles avec 403.
 */

import React, { useState } from 'react'
import { type MemoChapter } from '../../api/pedagogicalLog'

interface MemoItemEditorProps {
  chapters: MemoChapter[]
  onSave: (title: string, content: string, chapterId: string | null) => Promise<void>
  onCancel: () => void
}

export default function MemoItemEditor({ chapters, onSave, onCancel }: MemoItemEditorProps) {
  const [memoTitle, setMemoTitle] = useState('')
  const [memoContent, setMemoContent] = useState('')
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!memoTitle.trim() || !memoContent.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await onSave(memoTitle.trim(), memoContent.trim(), selectedChapterId)
      setMemoTitle('')
      setMemoContent('')
      setSelectedChapterId(null)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de la création du mémo"
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3 mt-2"
    >
      {errorMessage && (
        <p className="text-xs text-red-600">{errorMessage}</p>
      )}

      <div>
        <label htmlFor="memo-title" className="block text-xs text-gray-500 mb-1">
          Titre
        </label>
        <input
          id="memo-title"
          type="text"
          value={memoTitle}
          onChange={(e) => setMemoTitle(e.target.value)}
          placeholder="Titre du mémo (ex: Formule importante)"
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label htmlFor="memo-content" className="block text-xs text-gray-500 mb-1">
          Contenu (texte libre ou LaTeX)
        </label>
        <textarea
          id="memo-content"
          value={memoContent}
          onChange={(e) => setMemoContent(e.target.value)}
          placeholder="Contenu du mémo…"
          rows={3}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      <div>
        <label htmlFor="memo-chapter" className="block text-xs text-gray-500 mb-1">
          Chapitre (optionnel)
        </label>
        <select
          id="memo-chapter"
          value={selectedChapterId ?? ''}
          onChange={(e) => setSelectedChapterId(e.target.value || null)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        >
          <option value="">Général</option>
          {chapters.map((chapter) => (
            <option key={chapter.id} value={chapter.id}>
              {chapter.title}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSaving || !memoTitle.trim() || !memoContent.trim()}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? 'Ajout…' : 'Ajouter'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="bg-white text-gray-600 border border-gray-200 px-4 py-1.5 rounded-lg text-sm hover:bg-gray-50"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
