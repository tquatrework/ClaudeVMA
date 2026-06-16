import React, { useState } from 'react'
import apiClient from '../../api/client'

interface Comment {
  id: string
  timestampSeconds: number
  content: string
  createdAt: string
}

interface RecordingCommentTimelineProps {
  recordingId: string
  userRole: string
  onClose: () => void
}

export default function RecordingCommentTimeline({
  recordingId,
  userRole,
  onClose,
}: RecordingCommentTimelineProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [timestampSeconds, setTimestampSeconds] = useState<number>(0)
  const [content, setContent] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isParent = userRole === 'parent_financeur'

  if (isParent) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
        Accès non autorisé aux commentaires
      </div>
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!content.trim()) return

    setIsSubmitting(true)
    setError(null)
    try {
      await apiClient.post(`/recordings/${recordingId}/comments`, {
        timestampSeconds,
        content: content.trim(),
      })
      const newComment: Comment = {
        id: `local-${Date.now()}`,
        timestampSeconds,
        content: content.trim(),
        createdAt: new Date().toISOString(),
      }
      setComments((prev) => [...prev, newComment])
      setContent('')
      setTimestampSeconds(0)
    } catch {
      setError('Impossible d\'envoyer le commentaire')
    } finally {
      setIsSubmitting(false)
    }
  }

  const formatTimestamp = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="mt-2 border-t border-gray-100 pt-3 space-y-3">
      {comments.length > 0 && (
        <ul className="space-y-2">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-2 text-xs text-gray-700">
              <span className="shrink-0 font-mono text-indigo-600">
                {formatTimestamp(comment.timestampSeconds)}
              </span>
              <span>{comment.content}</span>
            </li>
          ))}
        </ul>
      )}

      {comments.length === 0 && (
        <p className="text-xs text-gray-400">Aucun commentaire pour l'instant.</p>
      )}

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <div>
          <label htmlFor={`timestamp-${recordingId}`} className="text-xs text-gray-600 block mb-1">
            Position (secondes)
          </label>
          <input
            id={`timestamp-${recordingId}`}
            type="number"
            min={0}
            value={timestampSeconds}
            onChange={(e) => setTimestampSeconds(Number(e.target.value))}
            className="w-24 border border-gray-300 rounded px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label htmlFor={`comment-${recordingId}`} className="text-xs text-gray-600 block mb-1">
            Commentaire
          </label>
          <textarea
            id={`comment-${recordingId}`}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded px-2 py-1 text-xs resize-none"
            placeholder="Votre commentaire…"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSubmitting || !content.trim()}
            className="bg-indigo-600 text-white px-3 py-1.5 rounded text-xs hover:bg-indigo-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Envoi…' : 'Envoyer'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Fermer
          </button>
        </div>
      </form>
    </div>
  )
}
