import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAvailabilitySlots } from '../../hooks/calendar/useAvailabilitySlots'
import { useOwnerCalendarActivities } from '../../hooks/calendar/useOwnerCalendarActivities'
import { useCalendarEvents } from '../../hooks/calendar/useCalendarEvents'
import { useEventDetailDialog } from '../../hooks/calendar/useEventDetailDialog'
import { useCalendarWeekNavigation } from '../../hooks/calendar/useCalendarWeekNavigation'
import { useCalendarUnifiedGridSlots } from '../../hooks/calendar/useCalendarUnifiedGridSlots'
import { useJoinConfirmedCourse } from '../../hooks/video/useJoinConfirmedCourse'
import { combineDateAndTime } from '../../utils/calendarDisplayWeek'
import {
  isAvailabilitySlotBlock,
  isCalendarEventBlock,
  buildAvailabilityFormInitialValues,
  type CalendarGridSlot,
  type AvailabilityFormTarget,
} from '../../utils/calendarUnifiedGridSlot'
import AvailabilityGrid from './AvailabilityGrid'
import CalendarWeekNavigator from './CalendarWeekNavigator'
import CalendarGridBlockOverlay from './CalendarGridBlockOverlay'
import CalendarModeSelector, { type CalendarInteractionMode } from './CalendarModeSelector'
import EventCreateFormModal from './EventCreateFormModal'
import EventDetailDialog from './EventDetailDialog'
import { ErrorMessage } from '../ui/ErrorMessage'
import AvailabilitySlotFormModal from './AvailabilitySlotFormModal'

interface CalendarUnifiedViewProps {
  ownerId: string
  userRole: string
  /**
   * Date de référence pour la semaine affichée au montage — optionnelle, `new Date()` par défaut.
   * Sert principalement les tests, qui ont besoin d'une semaine déterministe plutôt que celle du
   * jour d'exécution réel.
   */
  initialReferenceDate?: Date
}

/**
 * CalendarUnifiedView — grille unique fusionnant disponibilités (éditables), activités
 * `proposed`/`confirmed` (Accepter/Refuser révélés au clic) et événements de calendrier. Le
 * sélecteur de mode « en marge » (`CalendarModeSelector`, révisé le 2026-08-20, point A) commande
 * le clic sur une case vide : consultation (défaut implicite), disponibilité, ou événement — ce
 * dernier ouvre `EventCreateFormModal` avec un créneau par défaut déduit de la sélection.
 *
 * **Semaine calendaire réelle, navigable** (correction du 2026-08-20, point B) : la grille affiche
 * une semaine précise (dates réelles en en-tête), plus un gabarit hebdomadaire récurrent.
 * `useCalendarWeekNavigation` porte cet état ; les disponibilités (récurrentes par `dayOfWeek`)
 * sont projetées sur chaque semaine affichée, activités et événements (dates réelles) filtrés à
 * la semaine affichée — voir `calendarDisplayWeek.ts`/`useCalendarUnifiedGridSlots`.
 *
 * **Invitations à un événement** (bug réel corrigé le 2026-08-20, `InvitationBanner` retiré — voir
 * `useEventDetailDialog`/`useCalendarEvents` pour le détail) : un événement `viewerInvitationStatus:
 * "pending"` apparaît en couleur dédiée (`EVENT_PENDING`) ; le clic ouvre `EventDetailDialog`
 * (Accepter/Refuser, et Supprimer pour le créateur).
 */
export default function CalendarUnifiedView({
  ownerId,
  userRole,
  initialReferenceDate,
}: CalendarUnifiedViewProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<CalendarInteractionMode>('view')

  const { displayWeek, isCurrentWeek, goToPreviousWeek, goToNextWeek, goToToday } =
    useCalendarWeekNavigation(initialReferenceDate)

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
    events,
    isLoading: isLoadingEvents,
    errorMessage: eventsErrorMessage,
    dismissError: dismissEventsError,
    addEvent,
    markEventCancelled,
    respondingEventId,
    respondError: invitationRespondError,
    clearRespondError: clearInvitationRespondError,
    respondToEventInvitation,
    deletingEventId,
    deleteError,
    clearDeleteError,
    deleteEvent,
  } = useCalendarEvents(ownerId, '', '')

  const {
    selectedEvent: selectedEventForDetail,
    openEventDetail,
    closeEventDetail,
    handleRespondToInvitation,
    handleDeleteEvent,
  } = useEventDetailDialog({
    respondToEventInvitation,
    deleteEvent,
    clearInvitationRespondError,
    clearDeleteError,
  })

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

  const { gridSlots, activityBlocks, eventBlocks } = useCalendarUnifiedGridSlots(
    slots,
    activities,
    events,
    displayWeek,
  )

  const [formTarget, setFormTarget] = useState<AvailabilityFormTarget | null>(null)
  const [eventCreateTarget, setEventCreateTarget] = useState<{
    startAt: string
    endAt: string
  } | null>(null)
  const [revealedActivityId, setRevealedActivityId] = useState<string | null>(null)

  const handleCreateAt = (dayOfWeek: number, startTime: string, endTime: string) => {
    setRevealedActivityId(null)
    if (mode === 'availability') {
      clearActionError()
      setFormTarget({ mode: 'create', dayOfWeek, startTime, endTime })
    } else if (mode === 'event') {
      const dayDate =
        displayWeek.days.find((day) => day.dayOfWeek === dayOfWeek)?.date ?? displayWeek.weekStart
      setEventCreateTarget({
        startAt: combineDateAndTime(dayDate, startTime),
        endAt: combineDateAndTime(dayDate, endTime),
      })
    }
  }

  const openAvailabilityEditForm = (slot: CalendarGridSlot) => {
    if (!isAvailabilitySlotBlock(slot)) return
    clearActionError()
    setRevealedActivityId(null)
    setFormTarget({ mode: 'edit', slot })
  }

  const handleOverlayBlockClick = (slot: CalendarGridSlot) => {
    if (isAvailabilitySlotBlock(slot)) return
    if (isCalendarEventBlock(slot)) {
      openEventDetail(slot.event)
      return
    }
    if (slot.kind === 'PROPOSED') {
      setRevealedActivityId((previous) => (previous === slot.activity.id ? null : slot.activity.id))
    }
  }

  const renderBlockOverlay = (slot: CalendarGridSlot): React.ReactNode => {
    // Une disponibilité éditable ne porte jamais d'overlay — `undefined` direct, sans quoi
    // `AvailabilityGrid` recevrait un élément React toujours "truthy" (même vide) et rendrait un
    // `<div>` non cliquable pour l'édition à la place du `<button>` attendu.
    if (isAvailabilitySlotBlock(slot)) return undefined
    return (
      <CalendarGridBlockOverlay
        slot={slot}
        onAcceptActivity={(activityId) => respondToActivity(activityId, 'accept')}
        onDeclineActivity={(activityId) => respondToActivity(activityId, 'decline')}
        respondingActivityId={respondingActivityId}
        onJoinVideo={handleJoinVideo}
        isJoiningVideo={isJoiningVideo}
        joiningActivityId={joiningActivityId}
        revealedActivityId={revealedActivityId}
      />
    )
  }

  const closeAvailabilityForm = () => {
    clearActionError()
    setFormTarget(null)
  }

  const handleAvailabilitySubmit: React.ComponentProps<typeof AvailabilitySlotFormModal>['onSubmit'] =
    async (payload) => {
      const isSuccess =
        formTarget?.mode === 'edit'
          ? await updateSlot(formTarget.slot.id, payload)
          : await createSlot(payload)
      if (isSuccess) setFormTarget(null)
    }

  const handleAvailabilityDelete = async () => {
    if (formTarget?.mode !== 'edit') return
    const isSuccess = await deleteSlot(formTarget.slot.id)
    if (isSuccess) setFormTarget(null)
  }

  if (isLoading) {
    return <p className="text-gray-400 text-sm">Chargement du calendrier…</p>
  }

  if (loadError) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        {loadError}
      </div>
    )
  }

  const isEmpty =
    slots.length === 0 &&
    activityBlocks.length === 0 &&
    eventBlocks.length === 0 &&
    !isLoadingActivities &&
    !isLoadingEvents

  return (
    <div>
      <CalendarModeSelector mode={mode} onModeChange={setMode} />

      {activitiesLoadError && <ErrorMessage message={activitiesLoadError} className="mb-4" />}
      {eventsErrorMessage && (
        <ErrorMessage message={eventsErrorMessage} onClose={dismissEventsError} className="mb-4" />
      )}
      {respondError && (
        <ErrorMessage message={respondError} onClose={clearRespondError} className="mb-4" />
      )}
      {joinVideoError && (
        <ErrorMessage message={joinVideoError} onClose={clearJoinVideoError} className="mb-4" />
      )}

      {isEmpty && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
          <p className="text-sm text-gray-400">Aucune donnée dans votre calendrier pour l'instant</p>
        </div>
      )}

      <CalendarWeekNavigator
        weekStart={displayWeek.weekStart}
        isCurrentWeek={isCurrentWeek}
        onPreviousWeek={goToPreviousWeek}
        onNextWeek={goToNextWeek}
        onToday={goToToday}
      />

      <AvailabilityGrid
        slots={gridSlots}
        days={displayWeek.days}
        onCreateAt={handleCreateAt}
        onEditSlot={openAvailabilityEditForm}
        canCreate={mode !== 'view'}
        renderBlockOverlay={renderBlockOverlay}
        onOverlayBlockClick={handleOverlayBlockClick}
      />

      {formTarget && (
        <AvailabilitySlotFormModal
          editingSlot={formTarget.mode === 'edit' ? formTarget.slot : undefined}
          initialValues={buildAvailabilityFormInitialValues(formTarget)}
          isSaving={isSaving}
          errorMessage={actionError}
          onSubmit={handleAvailabilitySubmit}
          onDelete={formTarget.mode === 'edit' ? handleAvailabilityDelete : undefined}
          onClose={closeAvailabilityForm}
        />
      )}

      {eventCreateTarget && (
        <EventCreateFormModal
          ownerId={ownerId}
          userRole={userRole}
          defaultStartAt={eventCreateTarget.startAt}
          defaultEndAt={eventCreateTarget.endAt}
          weekFrom={displayWeek.weekStart.toISOString()}
          weekTo={displayWeek.weekEnd.toISOString()}
          onCreated={(event) => {
            addEvent(event)
            setEventCreateTarget(null)
          }}
          onClose={() => setEventCreateTarget(null)}
        />
      )}

      {selectedEventForDetail && (
        <EventDetailDialog
          event={selectedEventForDetail}
          viewerId={ownerId}
          onClose={closeEventDetail}
          onEventCancelled={markEventCancelled}
          isRespondingToInvitation={respondingEventId === selectedEventForDetail.id}
          invitationResponseError={invitationRespondError}
          onRespondToInvitation={handleRespondToInvitation}
          isDeleting={deletingEventId === selectedEventForDetail.id}
          deleteError={deleteError}
          onDeleteEvent={handleDeleteEvent}
        />
      )}
    </div>
  )
}
