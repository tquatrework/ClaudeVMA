import React, { useState } from 'react'
import { useRecordingList } from '../../hooks/video/useRecordingList'
import RecordingCommentTimeline from './RecordingCommentTimeline'

interface RecordingListPanelProps {
  roomId: string
  userRole: string
}

export default function RecordingListPanel({ roomId, userRole }: RecordingListPanelProps) {
  const [selectedRecordingId, setSelectedRecordingId] = useState<string | null>(null)

  const isParent = userRole === 'parent_financeur'
  const { recordings, isLoading, error } = useRecordingList(roomId, isParent)

  if (isParent) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        Accès non autorisé aux enregistrements
      </div>
    )
  }

  if (isLoading) {
    return <p className="text-gray-400 text-sm">Chargement des enregistrements…</p>
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        {error}
      </div>
    )
  }

  if (recordings.length === 0) {
    return (
      <p className="text-gray-500 text-sm">Aucun enregistrement disponible</p>
    )
  }

  return (
    <div className="space-y-3">
      {recordings.map((recording) => (
        <div
          key={recording.id}
          className="bg-white border border-gray-200 rounded-xl p-4 space-y-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-800 font-mono">
                {recording.id.slice(0, 16)}…
              </p>
              {recording.expiresAt && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Expire le{' '}
                  {new Date(recording.expiresAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {recording.isExpired ? (
                <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-500 font-medium">
                  Expiré
                </span>
              ) : recording.downloadUrl ? (
                <a
                  href={recording.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-indigo-600 hover:underline"
                >
                  Télécharger
                </a>
              ) : null}
            </div>
          </div>

          <button
            onClick={() =>
              setSelectedRecordingId(
                selectedRecordingId === recording.id ? null : recording.id,
              )
            }
            className="text-xs text-indigo-600 hover:underline"
          >
            {selectedRecordingId === recording.id
              ? 'Fermer les commentaires'
              : 'Ajouter un commentaire'}
          </button>

          {selectedRecordingId === recording.id && (
            <RecordingCommentTimeline
              recordingId={recording.id}
              userRole={userRole}
              onClose={() => setSelectedRecordingId(null)}
            />
          )}
        </div>
      ))}
    </div>
  )
}
