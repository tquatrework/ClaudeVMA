import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useUpcomingCourseRoomStatus } from '../../hooks/video/useUpcomingCourseRoomStatus'

interface UpcomingCourseJoinButtonProps {
  roomId: string
  calendarEventTitle?: string
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  ended: 'bg-gray-100 text-gray-500',
  scheduled: 'bg-yellow-100 text-yellow-700',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'En cours',
  ended: 'Terminée',
  scheduled: 'Planifiée',
}

export default function UpcomingCourseJoinButton({
  roomId,
  calendarEventTitle,
}: UpcomingCourseJoinButtonProps) {
  const navigate = useNavigate()
  const roomStatus = useUpcomingCourseRoomStatus(roomId)

  const handleJoin = () => {
    navigate(`/video/${roomId}`)
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleJoin}
        className="bg-indigo-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-indigo-700 transition-colors"
      >
        {calendarEventTitle ? `Rejoindre — ${calendarEventTitle}` : 'Rejoindre la visio'}
      </button>
      {roomStatus && (
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_BADGE_CLASS[roomStatus.status] ?? 'bg-gray-100 text-gray-500'}`}
        >
          {STATUS_LABEL[roomStatus.status] ?? roomStatus.status}
        </span>
      )}
    </div>
  )
}
