/**
 * MemoItemEditor — formulaire d'ajout d'un item dans un chapitre de mémo.
 * Supporte les types : text, formula (LaTeX simplifié), image (max 500 Ko — placeholder).
 * Élève uniquement — le backend refuse les autres rôles avec 403.
 */

import React, { useState } from 'react'
import { type MemoItemType } from '../../api/pedagogicalLog'

interface MemoItemEditorProps {
  onSave: (itemType: MemoItemType, content: string) => Promise<void>
  onCancel: () => void
}

export default function MemoItemEditor({ onSave, onCancel }: MemoItemEditorProps) {
  const [selectedItemType, setSelectedItemType] = useState<MemoItemType>('text')
  const [itemContent, setItemContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemContent.trim()) return
    setIsSaving(true)
    setErrorMessage(null)
    try {
      await onSave(selectedItemType, itemContent.trim())
      setItemContent('')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de l'ajout de l'item"
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

      <div className="flex gap-2 flex-wrap">
        {(['text', 'formula', 'image'] as MemoItemType[]).map((itemType) => (
          <label key={itemType} className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="item-type"
              value={itemType}
              checked={selectedItemType === itemType}
              onChange={() => {
                setSelectedItemType(itemType)
                setItemContent('')
              }}
              className="text-indigo-600"
            />
            <span className="text-xs text-gray-700 capitalize">
              {itemType === 'text' ? 'Texte' : itemType === 'formula' ? 'Formule LaTeX' : 'Image (URL)'}
            </span>
          </label>
        ))}
      </div>

      {selectedItemType === 'text' && (
        <textarea
          value={itemContent}
          onChange={(e) => setItemContent(e.target.value)}
          placeholder="Contenu textuel…"
          rows={3}
          required
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      )}

      {selectedItemType === 'formula' && (
        <div className="space-y-1">
          <input
            type="text"
            value={itemContent}
            onChange={(e) => setItemContent(e.target.value)}
            placeholder="Ex: \frac{a}{b} = c"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {itemContent && (
            <div className="text-xs text-gray-500 bg-white border border-gray-100 rounded px-2 py-1">
              Aperçu LaTeX (rendu non disponible) :{' '}
              <code className="font-mono text-indigo-700">{itemContent}</code>
            </div>
          )}
          <p className="text-xs text-gray-400">
            Saisissez la formule en LaTeX. Le rendu visuel est disponible dans la vue complète.
          </p>
        </div>
      )}

      {selectedItemType === 'image' && (
        <div className="space-y-1">
          <input
            type="url"
            value={itemContent}
            onChange={(e) => setItemContent(e.target.value)}
            placeholder="URL de l'image (max 500 Ko)"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
          <p className="text-xs text-gray-400">
            Taille maximale : 500 Ko. L'upload direct sera disponible dans une prochaine version.
          </p>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isSaving || !itemContent.trim()}
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
