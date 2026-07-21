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
import { EmptyState } from '../components/ui/EmptyState'
import {
  fetchOpenActivities,
  createOpenActivity,
  type OpenActivity,
  type CreateOpenActivityPayload,
} from '../api/learningActivity'
import { OpenActivitiesList } from '../components/learning-activity/OpenActivitiesList'
import { RpOpenActivityPublisher } from '../components/learning-activity/RpOpenActivityPublisher'

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
