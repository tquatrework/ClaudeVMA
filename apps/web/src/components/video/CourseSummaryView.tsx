import React, { useState } from 'react'
import { useCourseSummaryPublish } from '../../hooks/video/useCourseSummaryPublish'

interface CourseSummaryViewProps {
  roomId: string
  userRole: string
  roomStatus: string
}

const ROLES_ALLOWED_TO_PUBLISH_SUMMARY = ['formateur', 'responsable_pedagogique', 'animateur_pedagogique']

export default function CourseSummaryView({ roomId, userRole, roomStatus }: CourseSummaryViewProps) {
  const [summaryContent, setSummaryContent] = useState('')
  const { isSubmitting, isPublished, error, publish } = useCourseSummaryPublish(roomId)

  const canPublishSummary =
    ROLES_ALLOWED_TO_PUBLISH_SUMMARY.includes(userRole) && roomStatus === 'ended'

  if (!canPublishSummary) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-500 text-sm">
        Résumé non disponible
      </div>
    )
  }

  if (isPublished) {
    return (
      <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
        <p className="text-green-700 text-sm font-medium">Résumé publié avec succès</p>
        <p className="text-green-600 text-sm mt-1 whitespace-pre-wrap">{summaryContent}</p>
      </div>
    )
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!summaryContent.trim()) return

    await publish(summaryContent.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor={`summary-${roomId}`} className="text-sm font-medium text-gray-700 block mb-1">
          Résumé de cours
        </label>
        <textarea
          id={`summary-${roomId}`}
          value={summaryContent}
          onChange={(e) => setSummaryContent(e.target.value)}
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
          placeholder="Décrivez le contenu de la session…"
        />
      </div>

      {error && (
        <p className="text-red-600 text-sm">{error}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting || !summaryContent.trim()}
        className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Publication…' : 'Publier le résumé'}
      </button>
    </form>
  )
}
