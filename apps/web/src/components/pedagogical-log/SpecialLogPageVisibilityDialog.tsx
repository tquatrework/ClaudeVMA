/**
 * SpecialLogPageVisibilityDialog — dialog de création d'une page spéciale du cahier de texte.
 * Réservé au RP. Permet de choisir si la page est masquée à l'élève (hiddenFromStudent).
 *
 * Route API : POST /students/:studentId/pedagogical-log/special-pages
 */

import React, { useRef, useState } from 'react'
import { createSpecialLogPage, type PedagogicalLogPage } from '../../api/pedagogicalLog'

interface SpecialLogPageVisibilityDialogProps {
  studentId: string
  onCreated: (newPage: PedagogicalLogPage) => void
  onClose: () => void
}

export default function SpecialLogPageVisibilityDialog({
  studentId,
  onCreated,
  onClose,
}: SpecialLogPageVisibilityDialogProps) {
  const [content, setContent] = useState('')
  const [isHiddenFromStudent, setIsHiddenFromStudent] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const dialogRef = useRef<HTMLDivElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      const newPage = await createSpecialLogPage(studentId, {
        content: content.trim(),
        hiddenFromStudent: isHiddenFromStudent,
      })
      onCreated(newPage)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la création de la page spéciale'
      setErrorMessage(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      role="dialog"
      aria-modal="true"
      aria-label="Créer une page spéciale"
      onClick={(e) => {
        if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
          onClose()
        }
      }}
    >
      <div
        ref={dialogRef}
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 p-6 space-y-4"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Créer une page spéciale</h2>
            <p className="text-xs text-purple-600 mt-0.5">Réservé au Responsable Pédagogique</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Fermer"
          >
            ✕
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="special-page-content" className="block text-sm font-medium text-gray-700 mb-1">
              Contenu
            </label>
            <textarea
              id="special-page-content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Contenu de la page spéciale…"
              rows={5}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none"
            />
          </div>

          <div className="flex items-center gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
            <input
              id="hidden-from-student"
              type="checkbox"
              checked={isHiddenFromStudent}
              onChange={(e) => setIsHiddenFromStudent(e.target.checked)}
              className="w-4 h-4 rounded text-purple-600"
            />
            <div>
              <label htmlFor="hidden-from-student" className="text-sm font-medium text-gray-800 cursor-pointer">
                Masquer à l'élève
              </label>
              <p className="text-xs text-gray-500 mt-0.5">
                Si coché, l'élève ne verra pas cette page dans son cahier de texte.
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={isSaving || !content.trim()}
              className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
            >
              {isSaving ? 'Création…' : 'Créer la page spéciale'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm hover:bg-gray-200"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
