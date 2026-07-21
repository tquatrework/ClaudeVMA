/**
 * OpenActivityDetailPage — Phase 13 (learning-activity-service)
 *
 * Détail d'une activité non pourvue.
 * - Le formateur peut accepter l'activité via une dialog de confirmation.
 * - Une fois le quota atteint, l'activité passe à "filled" et disparaît de la liste ouverte.
 * - Le RP/AP voit les détails complets et peut modifier/annuler.
 *
 * Routes API consommées :
 *   GET   /open-activities/:id
 *   POST  /open-activities/:id/accept
 *   PATCH /open-activities/:id
 */

import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { StatusBadge } from '../components/ui/StatusBadge'
import {
  OPEN_ACTIVITY_STATUS_LABELS,
  OPEN_ACTIVITY_STATUS_BADGE_CLASSES,
} from '../types/learningActivity'
import {
  fetchOpenActivity,
  acceptOpenActivity,
  updateOpenActivity,
  type OpenActivity,
  type OpenActivityStatus,
} from '../api/learningActivity'
import { OpenActivityAcceptDialog } from '../components/learning-activity/OpenActivityAcceptDialog'
import { OpenActivityActionsPanel } from '../components/learning-activity/OpenActivityActionsPanel'

export default function OpenActivityDetailPage() {
  const { activityId } = useParams<{ activityId: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const [openActivity, setOpenActivity] = useState<OpenActivity | null>(null)
  const [isLoadingActivity, setIsLoadingActivity] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Dialog d'acceptation
  const [shouldShowAcceptDialog, setShouldShowAcceptDialog] = useState(false)
  const [acceptMessage, setAcceptMessage] = useState('')
  const [isAccepting, setIsAccepting] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [acceptSuccessMessage, setAcceptSuccessMessage] = useState<string | null>(null)

  // Modification RP/AP
  const [shouldShowEditForm, setShouldShowEditForm] = useState(false)
  const [editDeadline, setEditDeadline] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)

  const isTeacher = hasRole('formateur')
  const isRp = hasRole('responsable_pedagogique')
  const isAp = hasRole('animateur_pedagogique')
  const canAccept = isTeacher
  const canEdit = isRp || isAp

  useEffect(() => {
    if (!activityId) return

    setIsLoadingActivity(true)
    setLoadError(null)

    fetchOpenActivity(activityId)
      .then((activity) => {
        setOpenActivity(activity)
        setEditDeadline(activity.deadline ?? '')
      })
      .catch((error: unknown) => {
        const responseStatus = (error as { response?: { status?: number } })?.response?.status
        if (responseStatus === 404) {
          setLoadError('Activité introuvable.')
        } else {
          setLoadError('Impossible de charger le détail de l\'activité.')
        }
      })
      .finally(() => setIsLoadingActivity(false))
  }, [activityId])

  const handleAcceptActivity = async () => {
    if (!activityId) return

    setIsAccepting(true)
    setAcceptError(null)

    try {
      await acceptOpenActivity(activityId, {
        message: acceptMessage.trim() || undefined,
      })

      // Mise à jour locale : incrémenter filledSlots
      setOpenActivity((previous) => {
        if (!previous) return previous
        const updatedFilledSlots = previous.filledSlots + 1
        const updatedStatus: OpenActivityStatus =
          updatedFilledSlots >= previous.requiredSlots ? 'filled' : 'partially_filled'
        return { ...previous, filledSlots: updatedFilledSlots, status: updatedStatus }
      })

      setShouldShowAcceptDialog(false)
      setAcceptMessage('')
      setAcceptSuccessMessage(
        'Activité acceptée avec succès. Un événement a été ajouté à votre calendrier.',
      )
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 409) {
        setAcceptError('Cette activité est déjà pourvue.')
      } else if (responseStatus === 403) {
        setAcceptError('Vous n\'êtes pas autorisé à accepter cette activité.')
      } else {
        setAcceptError('Impossible d\'accepter l\'activité. Veuillez réessayer.')
      }
    } finally {
      setIsAccepting(false)
    }
  }

  const handleCancelActivity = async () => {
    if (!activityId || !openActivity) return

    setIsUpdating(true)
    setUpdateError(null)

    try {
      const updatedActivity = await updateOpenActivity(activityId, { status: 'cancelled' })
      setOpenActivity(updatedActivity)
      setShouldShowEditForm(false)
    } catch {
      setUpdateError('Impossible d\'annuler l\'activité.')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUpdateDeadline = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activityId) return

    setIsUpdating(true)
    setUpdateError(null)

    try {
      const updatedActivity = await updateOpenActivity(activityId, {
        deadline: editDeadline || undefined,
      })
      setOpenActivity(updatedActivity)
      setShouldShowEditForm(false)
    } catch {
      setUpdateError('Impossible de modifier l\'activité.')
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoadingActivity) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement de l'activité…</p>
      </Layout>
    )
  }

  if (loadError || !openActivity) {
    return (
      <Layout>
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => navigate('/open-activities')}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Retour aux activités non pourvues
          </button>
          <p className="text-red-600">{loadError ?? 'Activité introuvable.'}</p>
        </div>
      </Layout>
    )
  }

  const isActivityFilled = openActivity.status === 'filled'
  const isActivityCancelled = openActivity.status === 'cancelled'
  const isActivityAcceptable =
    canAccept && !isActivityFilled && !isActivityCancelled

  return (
    <Layout>
      <div className="max-w-2xl space-y-6">
        {/* Navigation */}
        <button
          type="button"
          onClick={() => navigate('/open-activities')}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Retour aux activités non pourvues
        </button>

        {/* Carte détail */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold text-gray-900">{openActivity.title}</h1>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                  {openActivity.subject}
                </span>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {openActivity.level}
                </span>
              </div>
            </div>
            <StatusBadge
              status={openActivity.status}
              label={OPEN_ACTIVITY_STATUS_LABELS[openActivity.status]}
              badgeClasses={OPEN_ACTIVITY_STATUS_BADGE_CLASSES}
              size="md"
            />
          </div>

          <p className="text-sm text-gray-700 whitespace-pre-wrap">{openActivity.description}</p>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Postes</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">
                {openActivity.filledSlots} / {openActivity.requiredSlots} pourvus
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Publiée le</p>
              <p className="text-sm font-medium text-gray-800 mt-0.5">
                {new Date(openActivity.publishedAt).toLocaleDateString('fr-FR')}
              </p>
            </div>
            {openActivity.deadline && (
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Date limite</p>
                <p className="text-sm font-medium text-gray-800 mt-0.5">
                  {new Date(openActivity.deadline).toLocaleDateString('fr-FR')}
                </p>
              </div>
            )}
          </div>

          {/* Message de succès d'acceptation */}
          {acceptSuccessMessage && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {acceptSuccessMessage}
            </div>
          )}

          <OpenActivityActionsPanel
            isActivityAcceptable={isActivityAcceptable}
            acceptSuccessMessage={acceptSuccessMessage}
            onOpenAcceptDialog={() => setShouldShowAcceptDialog(true)}
            canEdit={canEdit}
            isActivityCancelled={isActivityCancelled}
            isActivityFilled={isActivityFilled}
            shouldShowEditForm={shouldShowEditForm}
            onToggleEditForm={() => setShouldShowEditForm(!shouldShowEditForm)}
            onCancelActivity={handleCancelActivity}
            isUpdating={isUpdating}
            editDeadline={editDeadline}
            onEditDeadlineChange={setEditDeadline}
            updateError={updateError}
            onSubmitEditForm={handleUpdateDeadline}
            onCancelEditForm={() => setShouldShowEditForm(false)}
          />
        </div>

        {/* Dialog d'acceptation */}
        {shouldShowAcceptDialog && (
          <OpenActivityAcceptDialog
            activityTitle={openActivity.title}
            acceptMessage={acceptMessage}
            isAccepting={isAccepting}
            acceptError={acceptError}
            onMessageChange={setAcceptMessage}
            onConfirm={handleAcceptActivity}
            onCancel={() => {
              setShouldShowAcceptDialog(false)
              setAcceptMessage('')
              setAcceptError(null)
            }}
          />
        )}
      </div>
    </Layout>
  )
}
