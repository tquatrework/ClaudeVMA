import React, { useState } from 'react'
import type { AvailabilitySlot } from '../../types/calendar'
import { useAvailabilitySlots } from '../../hooks/calendar/useAvailabilitySlots'
import AvailabilityGrid from './AvailabilityGrid'
import AvailabilitySlotFormModal, {
  type AvailabilitySlotFormInitialValues,
} from './AvailabilitySlotFormModal'

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
 */
export default function AvailabilityTab({ ownerId }: AvailabilityTabProps) {
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

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null)

  const openCreateForm = (dayOfWeek: number, startTime: string) => {
    clearActionError()
    setFormTarget({ mode: 'create', dayOfWeek, startTime })
  }

  const openEditForm = (slot: AvailabilitySlot) => {
    clearActionError()
    setFormTarget({ mode: 'edit', slot })
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
        modifier ou le supprimer.
      </p>

      {slots.length === 0 && (
        <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-xl text-center">
          <p className="text-sm text-gray-400">Aucun créneau de disponibilité renseigné</p>
        </div>
      )}

      <AvailabilityGrid slots={slots} onCreateAt={openCreateForm} onEditSlot={openEditForm} />

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
