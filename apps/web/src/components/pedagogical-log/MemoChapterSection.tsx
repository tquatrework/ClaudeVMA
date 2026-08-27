/**
 * MemoChapterSection — un chapitre du mémo élève : titre (renommable),
 * suppression, liste de ses items (avec suppression individuelle), et
 * formulaire d'ajout d'item.
 *
 * Choix tranché sans instruction ferme : seule la **suppression** d'un item
 * est proposée ici (pas d'édition en place) — le contrat serveur permet de
 * modifier `content`/`order` (`PUT .../items/:itemId`), mais rien dans le
 * plan ne le demandait explicitement, et pour une image le serveur lui-même
 * ne permet pas de remplacer les octets par cette route (« supprimer puis
 * recréer », `docs/routes.md`). Portée volontairement étroite, cohérente
 * avec le reste du chantier — à étendre si le besoin se confirme.
 */

import React, { useState } from 'react'
import { deleteMemoChapter, deleteMemoItem, updateMemoChapter } from '../../api/pedagogicalLogMemos'
import type { MemoChapter, MemoItem } from '../../types/memo'
import { getMemoWriteErrorMessage } from '../../utils/memo'
import { MemoItemDisplay } from './MemoItemDisplay'
import MemoChapterEditor from './MemoChapterEditor'
import MemoItemEditor from './MemoItemEditor'

interface MemoChapterSectionProps {
  chapter: MemoChapter
  canWrite: boolean
  onChapterRenamed: (chapterId: string, title: string) => void
  onChapterDeleted: (chapterId: string) => void
  onItemCreated: (chapterId: string, item: MemoItem) => void
  onItemDeleted: (chapterId: string, itemId: string) => void
}

export function MemoChapterSection({
  chapter,
  canWrite,
  onChapterRenamed,
  onChapterDeleted,
  onItemCreated,
  onItemDeleted,
}: MemoChapterSectionProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [isAddingItem, setIsAddingItem] = useState(false)
  const [isDeletingChapter, setIsDeletingChapter] = useState(false)
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const handleRename = async (title: string) => {
    const updated = await updateMemoChapter(chapter.id, { title })
    onChapterRenamed(chapter.id, updated.title)
    setIsRenaming(false)
  }

  const handleDeleteChapter = async () => {
    if (!window.confirm(`Supprimer le chapitre « ${chapter.title} » et toutes ses notes ?`)) return
    setIsDeletingChapter(true)
    setActionError(null)
    try {
      await deleteMemoChapter(chapter.id)
      onChapterDeleted(chapter.id)
    } catch (err: unknown) {
      setActionError(getMemoWriteErrorMessage(err))
      setIsDeletingChapter(false)
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!window.confirm('Supprimer cette note ?')) return
    setDeletingItemId(itemId)
    setActionError(null)
    try {
      await deleteMemoItem(chapter.id, itemId)
      onItemDeleted(chapter.id, itemId)
    } catch (err: unknown) {
      setActionError(getMemoWriteErrorMessage(err))
    } finally {
      setDeletingItemId(null)
    }
  }

  if (isRenaming) {
    return (
      <section>
        <MemoChapterEditor
          initialTitle={chapter.title}
          onSave={handleRename}
          onCancel={() => setIsRenaming(false)}
          translateError={getMemoWriteErrorMessage}
        />
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between border-b border-gray-100 pb-1 mb-2">
        <h3 className="text-sm font-medium text-gray-700">{chapter.title}</h3>
        {canWrite && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIsRenaming(true)}
              className="text-xs text-indigo-500 hover:underline"
            >
              Renommer
            </button>
            <button
              type="button"
              onClick={handleDeleteChapter}
              disabled={isDeletingChapter}
              className="text-xs text-red-500 hover:underline disabled:opacity-50"
            >
              {isDeletingChapter ? 'Suppression…' : 'Supprimer'}
            </button>
          </div>
        )}
      </div>

      {actionError && <p className="text-xs text-red-600 mb-2">{actionError}</p>}

      {chapter.items.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Aucune note dans ce chapitre.</p>
      ) : (
        <ul className="space-y-2">
          {chapter.items.map((item) => (
            <li
              key={item.id}
              className="bg-white border border-gray-200 rounded-lg px-3 py-2 flex items-start justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <MemoItemDisplay item={item} />
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => handleDeleteItem(item.id)}
                  disabled={deletingItemId === item.id}
                  className="shrink-0 text-xs text-red-400 hover:underline disabled:opacity-50"
                >
                  {deletingItemId === item.id ? '…' : 'Supprimer'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <div className="mt-2">
          {isAddingItem ? (
            <MemoItemEditor
              chapterId={chapter.id}
              onSave={(item) => {
                onItemCreated(chapter.id, item)
                setIsAddingItem(false)
              }}
              onCancel={() => setIsAddingItem(false)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsAddingItem(true)}
              className="text-xs text-indigo-500 hover:underline"
            >
              + Ajouter une note
            </button>
          )}
        </div>
      )}
    </section>
  )
}
