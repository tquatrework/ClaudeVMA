/**
 * InternalNotesPanel — notes internes confidentielles (RP / administrateur financier).
 * Extrait de ProfilePage (lot 10 — normalisation, découpage > 300 lignes).
 * L'état du formulaire d'ajout (contenu, mode édition) est géré localement : il n'est
 * utilisé nulle part ailleurs dans ProfilePage.
 */

import React, { useState } from 'react'

interface InternalNote {
  id: string
  authorId?: string
  content: string
  createdAt: string
}

interface InternalNotesPanelProps {
  internalNotes: InternalNote[]
  addNote: (content: string) => Promise<boolean>
  isSavingNote: boolean
  noteSaveError: string | null
}

export function InternalNotesPanel({
  internalNotes,
  addNote,
  isSavingNote,
  noteSaveError,
}: InternalNotesPanelProps) {
  const [newNoteContent, setNewNoteContent] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)

  const handleAddNote = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!newNoteContent.trim()) return
    const success = await addNote(newNoteContent.trim())
    if (success) {
      setNewNoteContent('')
      setIsAddingNote(false)
    }
  }

  return (
    <div className="bg-white border border-amber-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          Notes internes
          <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            Confidentiel
          </span>
        </h2>
        {!isAddingNote && (
          <button
            onClick={() => setIsAddingNote(true)}
            className="text-sm text-indigo-600 hover:underline"
          >
            Ajouter une note
          </button>
        )}
      </div>

      {noteSaveError && (
        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {noteSaveError}
        </div>
      )}

      {isAddingNote && (
        <form onSubmit={handleAddNote} className="mb-4 space-y-3">
          <textarea
            required
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Note interne (invisible pour l'élève, le parent et le formateur)…"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
          />
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSavingNote || !newNoteContent.trim()}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSavingNote ? 'Ajout…' : 'Ajouter'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingNote(false)
                setNewNoteContent('')
              }}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {internalNotes.length === 0 && !isAddingNote ? (
        <p className="text-gray-400 text-sm">Aucune note interne</p>
      ) : (
        <ul className="space-y-3">
          {internalNotes.map((note) => (
            <li
              key={note.id}
              className="p-3 bg-amber-50 border border-amber-100 rounded-lg"
            >
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(note.createdAt).toLocaleString('fr-FR')}
                {note.authorId && ` · par ${note.authorId.slice(0, 8)}…`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
