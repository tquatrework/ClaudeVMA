/**
 * MemoChapterEditor — formulaire de création OU de renommage d'un chapitre
 * de mémo. Un seul composant pour les deux usages (mode déterminé par la
 * présence d'`initialTitle`), pour ne pas dupliquer le formulaire titre+
 * boutons — même discipline que `LogEntryAttachments` (`canManage`).
 */

import React, { useRef, useEffect, useState } from 'react'
import { MEMO_CHAPTER_TITLE_MAX_LENGTH } from '../../utils/memo'

const DEFAULT_ERROR_MESSAGE = (isRenaming: boolean) =>
  isRenaming ? 'Erreur lors du renommage du chapitre' : 'Erreur lors de la création du chapitre'

interface MemoChapterEditorProps {
  /** Présent = mode renommage ; absent = mode création. */
  initialTitle?: string
  onSave: (title: string) => Promise<void>
  onCancel: () => void
  /**
   * Traduit une erreur d'écriture en message affichable — par défaut lit
   * `err.response.data.message` avec un repli générique. L'appelant peut
   * fournir une traduction plus précise (ex. plafond de chapitres atteint,
   * `getMemoWriteErrorMessage`) sans que la logique de soumission du
   * formulaire ait à connaître les codes d'erreur du mémo.
   */
  translateError?: (err: unknown) => string
}

export default function MemoChapterEditor({
  initialTitle,
  onSave,
  onCancel,
  translateError,
}: MemoChapterEditorProps) {
  const isRenaming = initialTitle !== undefined
  const [chapterTitle, setChapterTitle] = useState(initialTitle ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chapterTitle.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await onSave(chapterTitle.trim())
      if (!isRenaming) setChapterTitle('')
    } catch (err: unknown) {
      const message =
        translateError?.(err) ??
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        DEFAULT_ERROR_MESSAGE(isRenaming)
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
      <h3 className="text-sm font-medium text-indigo-800">
        {isRenaming ? 'Renommer le chapitre' : 'Nouveau chapitre'}
      </h3>

      {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}

      <input
        ref={inputRef}
        type="text"
        value={chapterTitle}
        onChange={(e) => setChapterTitle(e.target.value)}
        placeholder="Titre du chapitre (ex: Trigonométrie)"
        maxLength={MEMO_CHAPTER_TITLE_MAX_LENGTH}
        required
        className="w-full border border-indigo-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSaving || !chapterTitle.trim()}
          className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {isSaving ? 'Enregistrement…' : isRenaming ? 'Renommer' : 'Créer'}
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
