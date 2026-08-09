/**
 * Écran de confidentialité — visibilité champ par champ
 * (`GET|PUT /profiles/:userId/field-visibility`).
 *
 * Le serveur renvoie le catalogue complet avec les valeurs par défaut : cette
 * page n'énumère aucun champ et n'invente aucun défaut. L'enregistrement est un
 * upsert partiel — seuls les champs réellement changés sont envoyés.
 */

import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useFieldVisibility } from '../hooks/profile/useFieldVisibility'
import Layout from '../components/Layout'
import { FieldVisibilityGroup } from '../components/profile/FieldVisibilityGroup'
import type {
  FieldVisibilityAudience,
  FieldVisibilityEntry,
  FieldVisibilityUpdate,
} from '../types/profile'

/** Ordre d'apparition des blocs à l'écran. Tout bloc inattendu passe à la fin. */
const BLOCK_ORDER = ['administrative', 'pedagogical-student', 'pedagogical-teacher']

function sortBlocks(blocks: string[]): string[] {
  return [...blocks].sort((left, right) => {
    const leftIndex = BLOCK_ORDER.indexOf(left)
    const rightIndex = BLOCK_ORDER.indexOf(right)
    return (leftIndex === -1 ? BLOCK_ORDER.length : leftIndex) -
      (rightIndex === -1 ? BLOCK_ORDER.length : rightIndex)
  })
}

function groupByBlock(entries: FieldVisibilityEntry[]): Record<string, FieldVisibilityEntry[]> {
  const grouped: Record<string, FieldVisibilityEntry[]> = {}
  for (const entry of entries) {
    grouped[entry.block] = [...(grouped[entry.block] ?? []), entry]
  }
  return grouped
}

export default function ProfileVisibilitySettingsPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const { user, hasRole } = useAuth()

  const isViewingOwnProfile = user?.id === userId
  const canAccess =
    isViewingOwnProfile ||
    hasRole('responsable_pedagogique', 'technicien_informatique', 'administrateur_financier')

  const { fields, isLoading, loadError, save, isSaving, saveError } = useFieldVisibility(
    userId,
    canAccess,
  )

  /** Réglages en cours d'édition, indexés par nom de champ. */
  const [selectedAudiences, setSelectedAudiences] = useState<
    Record<string, FieldVisibilityAudience>
  >({})
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!fields) return
    const initialSelection: Record<string, FieldVisibilityAudience> = {}
    for (const entry of fields) {
      initialSelection[entry.fieldName] = entry.audience
    }
    setSelectedAudiences(initialSelection)
  }, [fields])

  const groupedEntries = useMemo(() => groupByBlock(fields ?? []), [fields])
  const orderedBlocks = useMemo(() => sortBlocks(Object.keys(groupedEntries)), [groupedEntries])

  /** Seuls les champs réellement modifiés partent au serveur (upsert partiel). */
  const changedFields: FieldVisibilityUpdate[] = useMemo(() => {
    if (!fields) return []
    return fields
      .filter((entry) => selectedAudiences[entry.fieldName] !== entry.audience)
      .map((entry) => ({
        fieldName: entry.fieldName,
        audience: selectedAudiences[entry.fieldName],
      }))
  }, [fields, selectedAudiences])

  const errorMessage = saveError ?? loadError
  const [isErrorDismissed, setIsErrorDismissed] = useState(false)
  useEffect(() => {
    setIsErrorDismissed(false)
  }, [errorMessage])

  const handleAudienceChange = (fieldName: string, audience: FieldVisibilityAudience) => {
    setSuccessMessage(null)
    setSelectedAudiences((previous) => ({ ...previous, [fieldName]: audience }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSuccessMessage(null)
    const isSaved = await save(changedFields)
    if (isSaved) setSuccessMessage('Réglages de confidentialité enregistrés')
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          Accès refusé
        </div>
      </Layout>
    )
  }

  if (isLoading) {
    return (
      <Layout>
        <p className="text-gray-400">Chargement…</p>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(`/profiles/${userId}`)}
            className="text-sm text-indigo-600 hover:underline"
          >
            ← Retour au profil
          </button>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-2">Confidentialité</h1>
        <p className="text-sm text-gray-500 mb-6">
          Choisissez, champ par champ, qui peut voir vos informations. Par défaut, seuls votre
          prénom, votre nom, votre photo, votre niveau et vos matières sont visibles de vos
          contacts.
        </p>

        {errorMessage && !isErrorDismissed && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
            <span>{errorMessage}</span>
            <button
              onClick={() => setIsErrorDismissed(true)}
              className="text-red-400 hover:text-red-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center justify-between">
            <span>{successMessage}</span>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-green-400 hover:text-green-600 ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {fields && fields.length === 0 && (
          <p className="text-sm text-gray-400">Aucun champ à régler pour ce compte.</p>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {orderedBlocks.map((block) => (
            <FieldVisibilityGroup
              key={block}
              block={block}
              entries={groupedEntries[block]}
              selectedAudiences={selectedAudiences}
              onAudienceChange={handleAudienceChange}
              isDisabled={isSaving}
            />
          ))}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving || changedFields.length === 0}
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm"
            >
              {isSaving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/profiles/${userId}`)}
              className="bg-gray-100 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-200 text-sm"
            >
              Annuler
            </button>
            {changedFields.length > 0 && (
              <span className="text-xs text-gray-500">
                {changedFields.length} modification{changedFields.length > 1 ? 's' : ''} en attente
              </span>
            )}
          </div>
        </form>
      </div>
    </Layout>
  )
}
