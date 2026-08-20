import React, { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CalendarEvent } from './calendarTypes'
import { useAvailabilitySlots } from '../../hooks/calendar/useAvailabilitySlots'
import { useOwnerCalendarActivities } from '../../hooks/calendar/useOwnerCalendarActivities'
import { useCalendarEvents } from '../../hooks/calendar/useCalendarEvents'
import { useJoinConfirmedCourse } from '../../hooks/video/useJoinConfirmedCourse'
import { toScheduledActivityGridBlocks } from '../../utils/scheduledActivityGridBlocks'
import { toCalendarEventGridBlocks } from '../../utils/calendarEventGridBlocks'
import {
  isAvailabilitySlotBlock,
  isCalendarEventBlock,
  buildAvailabilityFormInitialValues,
  type CalendarGridSlot,
  type AvailabilityFormTarget,
} from '../../utils/calendarUnifiedGridSlot'
import AvailabilityGrid from './AvailabilityGrid'
import ActivityGridBlockOverlay from './ActivityGridBlockOverlay'
import EventGridBlockLabel from './EventGridBlockLabel'
import CalendarModeSelector, { type CalendarInteractionMode } from './CalendarModeSelector'
import QuickEventCreatePopover from './QuickEventCreatePopover'
import EventDetailDialog from './EventDetailDialog'
import InvitationBanner from './InvitationBanner'
import { ErrorMessage } from '../ui/ErrorMessage'
import AvailabilitySlotFormModal from './AvailabilitySlotFormModal'

interface CalendarUnifiedViewProps {
  ownerId: string
  userRole: string
}

/**
 * CalendarUnifiedView — grille unique fusionnant les trois sources du calendrier (chantier
 * calendrier vue unifiée, demande explicite de l'utilisateur du 2026-08-19) : créneaux de
 * disponibilité (éditables), activités planifiées `proposed`/`confirmed` (propositions de cours,
 * avec Accepter/Refuser révélés au clic — point 4) et événements de calendrier (`CalendarEvent`,
 * point 1, nouveaux sur cette grille). Un sélecteur de mode « en marge » (`CalendarModeSelector`,
 * point 2) commande ce qui se passe au clic sur une case vide : consultation (défaut, aucune
 * création), création de disponibilité, ou création d'événement — cette dernière ouvre
 * `QuickEventCreatePopover`, qui déduit la date réelle du jour/heure cliqués plutôt que de la
 * faire saisir à la main (point 3, corrige à la racine le bug "startTime must be a valid ISO
 * 8601…" signalé par l'utilisateur).
 *
 * Remplace `AvailabilityTab` (renommé) : ce composant portait déjà les disponibilités et les
 * activités ; les événements de calendrier (ancien onglet « Mes événements » /
 * `CalendarEventsPanel`, supprimé) y sont désormais fusionnés plutôt que scindés en onglets.
 */
export default function CalendarUnifiedView({ ownerId, userRole }: CalendarUnifiedViewProps) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<CalendarInteractionMode>('view')

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
    invitations,
    isLoading: isLoadingEvents,
    errorMessage: eventsErrorMessage,
    dismissError: dismissEventsError,
    addEvent,
    updateInvitationStatus,
    markEventCancelled,
  } = useCalendarEvents(ownerId, '', '')

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
  const eventBlocks = useMemo(() => toCalendarEventGridBlocks(events), [events])
  const gridSlots = useMemo<CalendarGridSlot[]>(
    () => [...slots, ...activityBlocks, ...eventBlocks],
    [slots, activityBlocks, eventBlocks],
  )

  const [formTarget, setFormTarget] = useState<AvailabilityFormTarget | null>(null)
  const [quickCreateTarget, setQuickCreateTarget] = useState<{
    dayOfWeek: number
    startTime: string
  } | null>(null)
  const [selectedEventForDetail, setSelectedEventForDetail] = useState<CalendarEvent | null>(null)
  const [revealedActivityId, setRevealedActivityId] = useState<string | null>(null)

  const handleCreateAt = (dayOfWeek: number, startTime: string) => {
    setRevealedActivityId(null)
    if (mode === 'availability') {
      clearActionError()
      setFormTarget({ mode: 'create', dayOfWeek, startTime })
    } else if (mode === 'event') {
      setQuickCreateTarget({ dayOfWeek, startTime })
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
      setSelectedEventForDetail(slot.event)
      return
    }
    if (slot.kind === 'PROPOSED') {
      setRevealedActivityId((previous) => (previous === slot.activity.id ? null : slot.activity.id))
    }
  }

  const renderBlockOverlay = (slot: CalendarGridSlot): React.ReactNode => {
    if (isAvailabilitySlotBlock(slot)) return undefined
    if (isCalendarEventBlock(slot)) return <EventGridBlockLabel block={slot} />
    return (
      <ActivityGridBlockOverlay
        block={slot}
        onAccept={(activityId) => respondToActivity(activityId, 'accept')}
        onDecline={(activityId) => respondToActivity(activityId, 'decline')}
        isResponding={respondingActivityId === slot.activity.id}
        onJoinVideo={handleJoinVideo}
        isJoiningVideo={isJoiningVideo && joiningActivityId === slot.activity.id}
        isRevealed={revealedActivityId === slot.activity.id}
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

  const handleInvitationStatusChange = (eventId: string, newStatus: 'pending' | 'accepted' | 'declined') => {
    updateInvitationStatus(eventId, newStatus)
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

      {invitations.length > 0 && (
        <InvitationBanner
          invitations={invitations}
          userId={ownerId}
          onStatusChange={handleInvitationStatusChange}
        />
      )}

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

      <AvailabilityGrid
        slots={gridSlots}
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

      {quickCreateTarget && (
        <QuickEventCreatePopover
          ownerId={ownerId}
          userRole={userRole}
          dayOfWeek={quickCreateTarget.dayOfWeek}
          startTime={quickCreateTarget.startTime}
          onCreated={(event) => {
            addEvent(event)
            setQuickCreateTarget(null)
          }}
          onClose={() => setQuickCreateTarget(null)}
        />
      )}

      {selectedEventForDetail && (
        <EventDetailDialog
          event={selectedEventForDetail}
          onClose={() => setSelectedEventForDetail(null)}
          onEventCancelled={markEventCancelled}
        />
      )}
    </div>
  )
}
