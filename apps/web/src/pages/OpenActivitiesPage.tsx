/**
 * OpenActivitiesPage — Phase 13 (learning-activity-service)
 *
 * Petites annonces pédagogiques : liste des activités non pourvues.
 * - Le formateur voit les activités ouvertes et peut les accepter.
 * - Le RP peut publier une nouvelle activité non pourvue.
 * - Le RP/AP peut modifier ou annuler une activité existante.
 *
 * Routes API consommées :
 *   GET  /open-activities
 *   POST /open-activities
 */

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { PageHeader } from '../components/ui/PageHeader'
import { StatusBadge } from '../components/ui/StatusBadge'
import { EmptyState } from '../components/ui/EmptyState'
import {
  OPEN_ACTIVITY_STATUS_LABELS,
  OPEN_ACTIVITY_STATUS_BADGE_CLASSES,
} from '../types/learningActivity'
import {
  fetchOpenActivities,
  createOpenActivity,
  type OpenActivity,
  type OpenActivityStatus,
  type CreateOpenActivityPayload,
} from '../api/learningActivity'

export default function OpenActivitiesPage() {
  const { hasRole } = useAuth()
  const navigate = useNavigate()

  const [openActivityList, setOpenActivityList] = useState<OpenActivity[]>([])
  const [isLoadingActivities, setIsLoadingActivities] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [shouldShowPublishForm, setShouldShowPublishForm] = useState(false)

  // Champs du formulaire de publication
  const [newActivityTitle, setNewActivityTitle] = useState('')
  const [newActivityDescription, setNewActivityDescription] = useState('')
  const [newActivitySubject, setNewActivitySubject] = useState('')
  const [newActivityLevel, setNewActivityLevel] = useState('')
  const [newActivityRequiredSlots, setNewActivityRequiredSlots] = useState(1)
  const [newActivityDeadline, setNewActivityDeadline] = useState('')
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishError, setPublishError] = useState<string | null>(null)

  const isTeacher = hasRole('formateur')
  const isRp = hasRole('responsable_pedagogique')
  const isAp = hasRole('animateur_pedagogique')
  const canPublish = isRp
  const canViewList = isTeacher || isRp || isAp

  useEffect(() => {
    if (!canViewList) return

    setIsLoadingActivities(true)
    setLoadError(null)

    fetchOpenActivities({ status: 'open' })
      .then((activities) => setOpenActivityList(activities))
      .catch(() => setLoadError('Impossible de charger les activités non pourvues.'))
      .finally(() => setIsLoadingActivities(false))
  }, [canViewList])

  const handlePublishActivity = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsPublishing(true)
    setPublishError(null)

    const payload: CreateOpenActivityPayload = {
      title: newActivityTitle.trim(),
      description: newActivityDescription.trim(),
      subject: newActivitySubject.trim(),
      level: newActivityLevel.trim(),
      requiredSlots: newActivityRequiredSlots,
    }
    if (newActivityDeadline) {
      payload.deadline = newActivityDeadline
    }

    try {
      const createdActivity = await createOpenActivity(payload)
      setOpenActivityList((previous) => [createdActivity, ...previous])
      setShouldShowPublishForm(false)
      setNewActivityTitle('')
      setNewActivityDescription('')
      setNewActivitySubject('')
      setNewActivityLevel('')
      setNewActivityRequiredSlots(1)
      setNewActivityDeadline('')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setPublishError('Vous n\'êtes pas autorisé à publier une activité non pourvue.')
      } else {
        setPublishError('Impossible de publier l\'activité. Vérifiez les champs et réessayez.')
      }
    } finally {
      setIsPublishing(false)
    }
  }

  const handleOpenActivityDetail = (activityId: string) => {
    navigate(`/open-activities/${activityId}`)
  }

  if (!canViewList) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux formateurs, animateurs pédagogiques et responsables pédagogiques.
        </p>
      </Layout>
    )
  }

  if (isLoadingActivities) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement des activités non pourvues…</p>
      </Layout>
    )
  }

  if (loadError) {
    return (
      <Layout>
        <p className="text-red-600">{loadError}</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader
          title="Activités non pourvues"
          subtitle="Petites annonces pédagogiques ouvertes aux formateurs disponibles."
          action={
            canPublish ? (
              <button
                type="button"
                onClick={() => setShouldShowPublishForm(true)}
                className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors"
              >
                Publier une annonce
              </button>
            ) : undefined
          }
        />

        {/* Formulaire de publication (RP) */}
        {shouldShowPublishForm && (
          <RpOpenActivityPublisher
            newActivityTitle={newActivityTitle}
            newActivityDescription={newActivityDescription}
            newActivitySubject={newActivitySubject}
            newActivityLevel={newActivityLevel}
            newActivityRequiredSlots={newActivityRequiredSlots}
            newActivityDeadline={newActivityDeadline}
            isPublishing={isPublishing}
            publishError={publishError}
            onTitleChange={setNewActivityTitle}
            onDescriptionChange={setNewActivityDescription}
            onSubjectChange={setNewActivitySubject}
            onLevelChange={setNewActivityLevel}
            onRequiredSlotsChange={setNewActivityRequiredSlots}
            onDeadlineChange={setNewActivityDeadline}
            onSubmit={handlePublishActivity}
            onCancel={() => setShouldShowPublishForm(false)}
          />
        )}

        {/* Liste des activités */}
        <OpenActivitiesList
          activityList={openActivityList}
          onSelectActivity={handleOpenActivityDetail}
        />
      </div>
    </Layout>
  )
}

// ─── Sous-composant : liste des activités non pourvues ────────────────────────

interface OpenActivitiesListProps {
  activityList: OpenActivity[]
  onSelectActivity: (activityId: string) => void
}

export function OpenActivitiesList({ activityList, onSelectActivity }: OpenActivitiesListProps) {
  if (activityList.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
        <p className="text-gray-400 text-sm">Aucune activité non pourvue pour le moment.</p>
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {activityList.map((activity) => (
        <li key={activity.id}>
          <button
            type="button"
            onClick={() => onSelectActivity(activity.id)}
            className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{activity.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{activity.description}</p>
                <div className="flex flex-wrap gap-2 mt-2">
                  <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                    {activity.subject}
                  </span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                    {activity.level}
                  </span>
                  {activity.deadline && (
                    <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded">
                      Date limite : {new Date(activity.deadline).toLocaleDateString('fr-FR')}
                    </span>
                  )}
                </div>
              </div>
              <div className="shrink-0 flex flex-col items-end gap-2">
                <StatusBadge
                  status={activity.status}
                  label={OPEN_ACTIVITY_STATUS_LABELS[activity.status]}
                  badgeClasses={OPEN_ACTIVITY_STATUS_BADGE_CLASSES}
                />
                <span className="text-xs text-gray-400">
                  {activity.filledSlots}/{activity.requiredSlots} poste
                  {activity.requiredSlots > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}

// ─── Sous-composant : formulaire de publication RP ────────────────────────────

interface RpOpenActivityPublisherProps {
  newActivityTitle: string
  newActivityDescription: string
  newActivitySubject: string
  newActivityLevel: string
  newActivityRequiredSlots: number
  newActivityDeadline: string
  isPublishing: boolean
  publishError: string | null
  onTitleChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  onSubjectChange: (value: string) => void
  onLevelChange: (value: string) => void
  onRequiredSlotsChange: (value: number) => void
  onDeadlineChange: (value: string) => void
  onSubmit: (event: React.FormEvent) => void
  onCancel: () => void
}

export function RpOpenActivityPublisher({
  newActivityTitle,
  newActivityDescription,
  newActivitySubject,
  newActivityLevel,
  newActivityRequiredSlots,
  newActivityDeadline,
  isPublishing,
  publishError,
  onTitleChange,
  onDescriptionChange,
  onSubjectChange,
  onLevelChange,
  onRequiredSlotsChange,
  onDeadlineChange,
  onSubmit,
  onCancel,
}: RpOpenActivityPublisherProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-gray-800">Publier une activité non pourvue</h2>
      <p className="text-sm text-gray-500">
        Cette annonce sera visible par tous les formateurs disponibles sur la plateforme.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="activity-title" className="block text-sm text-gray-700 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              id="activity-title"
              type="text"
              required
              value={newActivityTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPublishing}
            />
          </div>
          <div>
            <label htmlFor="activity-subject" className="block text-sm text-gray-700 mb-1">
              Matière <span className="text-red-500">*</span>
            </label>
            <input
              id="activity-subject"
              type="text"
              required
              value={newActivitySubject}
              onChange={(e) => onSubjectChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPublishing}
            />
          </div>
          <div>
            <label htmlFor="activity-level" className="block text-sm text-gray-700 mb-1">
              Niveau <span className="text-red-500">*</span>
            </label>
            <input
              id="activity-level"
              type="text"
              required
              value={newActivityLevel}
              onChange={(e) => onLevelChange(e.target.value)}
              placeholder="ex: Terminale, 3ème…"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPublishing}
            />
          </div>
          <div>
            <label htmlFor="activity-slots" className="block text-sm text-gray-700 mb-1">
              Nombre de postes <span className="text-red-500">*</span>
            </label>
            <input
              id="activity-slots"
              type="number"
              required
              min={1}
              value={newActivityRequiredSlots}
              onChange={(e) => onRequiredSlotsChange(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPublishing}
            />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="activity-deadline" className="block text-sm text-gray-700 mb-1">
              Date limite (optionnel)
            </label>
            <input
              id="activity-deadline"
              type="date"
              value={newActivityDeadline}
              onChange={(e) => onDeadlineChange(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              disabled={isPublishing}
            />
          </div>
        </div>

        <div>
          <label htmlFor="activity-description" className="block text-sm text-gray-700 mb-1">
            Description <span className="text-red-500">*</span>
          </label>
          <textarea
            id="activity-description"
            required
            rows={4}
            value={newActivityDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
            disabled={isPublishing}
          />
        </div>

        {publishError && <p className="text-red-600 text-sm">{publishError}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPublishing}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 transition-colors"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isPublishing}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPublishing ? 'Publication…' : 'Publier l\'annonce'}
          </button>
        </div>
      </form>
    </div>
  )
}
