import React, { useEffect, useState } from 'react'
import apiClient from '../../api/client'

interface AvailabilitySlot {
  id: string
  dayOfWeek?: string
  startTime?: string
  endTime?: string
  date?: string
  label?: string
}

interface AvailabilityEditorProps {
  ownerId: string
}

export default function AvailabilityEditor({ ownerId }: AvailabilityEditorProps) {
  const [availabilitySlots, setAvailabilitySlots] = useState<AvailabilitySlot[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    apiClient
      .get<AvailabilitySlot[]>(`/calendars/${ownerId}/availability`)
      .then(({ data }) => setAvailabilitySlots(Array.isArray(data) ? data : []))
      .catch(() => setErrorMessage('Impossible de charger les disponibilités'))
      .finally(() => setIsLoading(false))
  }, [ownerId])

  if (isLoading) {
    return <p className="text-sm text-gray-400">Chargement des disponibilités…</p>
  }

  if (errorMessage) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
        {errorMessage}
      </div>
    )
  }

  if (availabilitySlots.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
        <p className="text-sm text-gray-400">Aucun créneau de disponibilité renseigné</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {availabilitySlots.map((slot) => (
        <div
          key={slot.id}
          className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg text-sm"
        >
          {slot.label ? (
            <span className="text-gray-700">{slot.label}</span>
          ) : (
            <>
              {slot.dayOfWeek && (
                <span className="font-medium text-gray-700 capitalize">{slot.dayOfWeek}</span>
              )}
              {slot.date && (
                <span className="text-gray-500">
                  {new Date(slot.date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </span>
              )}
              {slot.startTime && slot.endTime && (
                <span className="text-gray-500">
                  {slot.startTime} – {slot.endTime}
                </span>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  )
}
