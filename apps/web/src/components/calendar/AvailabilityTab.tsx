import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { AvailabilitySlot } from '../../types/calendar'
import { useAvailabilitySlots } from '../../hooks/calendar/useAvailabilitySlots'
import { useOwnerCalendarActivities } from '../../hooks/calendar/useOwnerCalendarActivities'
import { useJoinConfirmedCourse } from '../../hooks/video/useJoinConfirmedCourse'
import {
  toScheduledActivityGridBlocks,
  type ScheduledActivityGridBlock,
} from '../../utils/scheduledActivityGridBlocks'
import AvailabilityGrid from './AvailabilityGrid'
import ActivityGridBlockOverlay from './ActivityGridBlockOverlay'
import { ErrorMessage } from '../ui/ErrorMessage'
import AvailabilitySlotFormModal, {
  type AvailabilitySlotFormInitialValues,
} from './AvailabilitySlotFormModal'

/** Slot affichable par la grille combinée — créneau de disponibilité éditable, ou activité
 * planifiée (proposition/confirmation de cours) en lecture seule avec overlay dédié. */
type CalendarGridSlot = AvailabilitySlot | ScheduledActivityGridBlock

function isAvailabilitySlotBlock(slot: CalendarGridSlot): slot is AvailabilitySlot {
  return slot.kind === 'AVAILABLE' || slot.kind === 'UNAVAILABLE'
}

interface AvailabilityTabProps {
  ownerId: string
}

type FormTarget =
  | { mode: 'create'; dayOfWeek: number; startTime: string }
  | { mode: 'edit'; slot: AvailabilitySlot }

function buildDefaultEndTime(startTime: string): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const nextHour = (hours + 1) % 24
  return `${nextHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function buildInitialValues(target: FormTarget): AvailabilitySlotFormInitialValues {
  if (target.mode === 'edit') {
    return {
      dayOfWeek: target.slot.dayOfWeek,
      startTime: target.slot.startTime,
      endTime: target.slot.endTime,
      kind: target.slot.kind,
      recurrence: target.slot.recurrence,
      recurrenceEndDate: target.slot.recurrenceEndDate,
    }
  }
  return {
    dayOfWeek: target.dayOfWeek,
    startTime: target.startTime,
    endTime: buildDefaultEndTime(target.startTime),
    kind: 'AVAILABLE',
    recurrence: 'NONE',
    recurrenceEndDate: null,
  }
}

/**
 * AvailabilityTab — onglet "Mes disponibilités" de CalendarPage. Compose le hook
 * d'orchestration, la grille et le formulaire modal, gère les 4 états (chargement, erreur,
 * vide, succès).
 *
 * Depuis le chantier calendrier de disponibilités, point 3 (2026-08-19), cette grille affiche
 * aussi les propositions/confirmations de créneau de cours dont l'utilisateur est participant ou
 * créateur (`GET /calendars/:ownerId` → `activities`, `useOwnerCalendarActivities`) — décision
 * explicite de l'utilisateur (2026-08-18) : directement dans la grille, pas dans une liste
 * séparée. Une proposition (`PROPOSED`, couleur pastel) porte ses boutons Accepter/Refuser
 * directement sur le bloc ; un cours déjà confirmé (`CONFIRMED`) s'affiche sans action.
 */
export default function AvailabilityTab({ ownerId }: AvailabilityTabProps) {
  const navigate = useNavigate()

  const {
    slots,
    isLoading,
    loadError,
    createSlot,
    updateSlot,
    deleteSlot,
    isSaving,
    actionError,
    clearActionError,
  } = useAvailabilitySlots(ownerId)

  const {
    activities,
    isLoading: isLoadingActivities,
    loadError: activitiesLoadError,
    respondingActivityId,
    respondError,
    clearRespondError,
    respondToActivity,
  } = useOwnerCalendarActivities(ownerId)

  const {
    resolveRoomId,
    isResolving: isJoiningVideo,
    resolveError: joinVideoError,
    clearResolveError: clearJoinVideoError,
  } = useJoinConfirmedCourse()
  const [joiningActivityId, setJoiningActivityId] = useState<string | null>(null)

  const handleJoinVideo = async (activityId: string) => {
    setJoiningActivityId(activityId)
    const roomId = await resolveRoomId(activityId)
    setJoiningActivityId(null)
    if (roomId) navigate(`/video-join/${roomId}`)
  }

  const activityBlocks = useMemo(() => toScheduledActivityGridBlocks(activities), [activities])
  const gridSlots = useMemo<CalendarGridSlot[]>(
    () => [...slots, ...activityBlocks],
    [slots, activityBlocks],
  )

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)

  const openCreateForm = (dayOfWeek: number, startTime: string) => {
    clearActionError()
    setFormTarget({ mode: 'create', dayOfWeek, startTime })
  }

  const openEditForm = (slot: CalendarGridSlot) => {
    if (!isAvailabilitySlotBlock(slot)) return
    clearActionError()
    setFormTarget({ mode: 'edit', slot })
  }

  const renderBlockOverlay = (slot: CalendarGridSlot): React.ReactNode => {
    if (isAvailabilitySlotBlock(slot)) return undefined
    return (
      <ActivityGridBlockOverlay
        block={slot}
        onAccept={(activityId) => respondToActivity(activityId, 'accept')}
        onDecline={(activityId) => respondToActivity(activityId, 'decline')}
        isResponding={respondingActivityId === slot.activity.id}
        onJoinVideo={handleJoinVideo}
        isJoiningVideo={isJoiningVideo && joiningActivityId === slot.activity.id}
      />
    )
  }

  const closeForm = () => {
    clearActionError()
    setFormTarget(null)
  }

  const handleSubmit: React.ComponentProps<typeof AvailabilitySlotFormModal>['onSubmit'] = async (
    payload,
  ) => {
    const isSuccess =
      formTarget?.mode === 'edit'
        ? await updateSlot(formTarget.slot.id, payload)
        : await createSlot(payload)
    if (isSuccess) setFormTarget(null)
  }

  const handleDelete = async () => {
    if (formTarget?.mode !== 'edit') return
    const isSuccess = await deleteSlot(formTarget.slot.id)
    if (isSuccess) setFormTarget(null)
  }

  if (isLoading) {
    return <p className="text-gray-400 text-sm">Chargement des disponibilités…</p>
  }

  if (loadError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        {loadError}
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">
        Cliquez sur une case vide pour ajouter un créneau, ou sur un créneau existant pour le
        modifier ou le supprimer. Les propositions de créneau de cours que vous avez reçues
        apparaissent aussi ci-dessous, en couleur distincte, avec leurs boutons Accepter/Refuser.
      </p>

      {activitiesLoadError && (
        <ErrorMessage message={activitiesLoadError} className="mb-4" />
      )}

      {respondError && (
        <ErrorMessage message={respondError} onClose={clearRespondError} className="mb-4" />
      )}

      {joinVideoError && (
        <ErrorMessage message={joinVideoError} onClose={clearJoinVideoError} className="mb-4" />
      )}

      {slots.length === 0 && activityBlocks.length === 0 && !isLoadingActivities && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
          <p className="text-sm text-gray-400">Aucun créneau de disponibilité renseigné</p>
        </div>
      )}

      <AvailabilityGrid
        slots={gridSlots}
        onCreateAt={openCreateForm}
        onEditSlot={openEditForm}
        renderBlockOverlay={renderBlockOverlay}
      />

      {formTarget && (
        <AvailabilitySlotFormModal
          editingSlot={formTarget.mode === 'edit' ? formTarget.slot : undefined}
          initialValues={buildInitialValues(formTarget)}
          isSaving={isSaving}
          errorMessage={actionError}
          onSubmit={handleSubmit}
          onDelete={formTarget.mode === 'edit' ? handleDelete : undefined}
          onClose={closeForm}
        />
      )}
    </div>
  )
}
