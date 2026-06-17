/**
 * MemoChapterEditor — formulaire de création d'un chapitre de mémo.
 * Utilisé dans StudentMemoPanel et InVideoMemoDrawer.
 */

import React, { useRef, useEffect, useState } from 'react'

interface MemoChapterEditorProps {
  onSave: (title: string) => Promise<void>
  onCancel: () => void
}

export default function MemoChapterEditor({ onSave, onCancel }: MemoChapterEditorProps) {
  const [chapterTitle, setChapterTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chapterTitle.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await onSave(chapterTitle.trim())
      setChapterTitle('')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la création du chapitre'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3"
    >
      <h3 className="text-sm font-medium text-indigo-800">Nouveau chapitre</h3>

      {errorMessage && (
        <p className="text-xs text-red-600">{errorMessage}</p>
      )}

      <input
        ref={inputRef}
        type="text"
        value={chapterTitle}
        onChange={(e) => setChapterTitle(e.target.value)}
        placeholder="Titre du chapitre (ex: Trigonométrie)"
        required
        className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSaving || !chapterTitle.trim()}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? 'Création…' : 'Créer'}
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
