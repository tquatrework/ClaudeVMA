/**
 * ForumModerationPanel — Phase 14 (community-path-service)
 *
 * Panneau de modération d'un forum : exclusion de membres.
 * Réservé aux AP et RP.
 *
 * Routes API consommées :
 *   POST /forums/:id/exclusions
 */

import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { createForumExclusion, type ForumExclusion } from '../api/communityPath'

export default function ForumModerationPanel() {
  const { forumId } = useParams<{ forumId: string }>()
  const navigate = useNavigate()
  const { hasRole } = useAuth()

  const [exclusionList, setExclusionList] = useState<ForumExclusion[]>([])
  const [excludedUserId, setExcludedUserId] = useState('')
  const [exclusionReason, setExclusionReason] = useState('')
  const [isExcluding, setIsExcluding] = useState(false)
  const [exclusionError, setExclusionError] = useState<string | null>(null)
  const [exclusionSuccess, setExclusionSuccess] = useState<string | null>(null)

  const isAp = hasRole('animateur_pedagogique')
  const isRp = hasRole('responsable_pedagogique')
  const canModerate = isAp || isRp

  if (!canModerate) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">
          Accès réservé aux animateurs pédagogiques et responsables pédagogiques.
        </p>
      </Layout>
    )
  }

  if (!forumId) {
    return (
      <Layout>
        <p className="text-red-600 text-sm">Identifiant du forum manquant.</p>
      </Layout>
    )
  }

  const handleExcludeMember = async (event: React.FormEvent) => {
    event.preventDefault()
    setIsExcluding(true)
    setExclusionError(null)
    setExclusionSuccess(null)

    try {
      const newExclusion = await createForumExclusion(forumId, {
        excludedUserId: excludedUserId.trim(),
        reason: exclusionReason.trim() || undefined,
      })
      setExclusionList((previous) => [...previous, newExclusion])
      setExcludedUserId('')
      setExclusionReason('')
      setExclusionSuccess('Le membre a été exclu du forum.')
    } catch (error: unknown) {
      const responseStatus = (error as { response?: { status?: number } })?.response?.status
      if (responseStatus === 403) {
        setExclusionError("Vous n'êtes pas autorisé à effectuer cette exclusion.")
      } else if (responseStatus === 404) {
        setExclusionError('Utilisateur ou forum introuvable.')
      } else {
        setExclusionError("Impossible d'exclure le membre.")
      }
    } finally {
      setIsExcluding(false)
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Navigation retour */}
        <button
          type="button"
          onClick={() => navigate(`/community/forums/${forumId}`)}
          className="text-sm text-indigo-600 hover:underline"
        >
          ← Retour au forum
        </button>

        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Modération du forum</h1>
          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-medium">
            Réservé modérateurs
          </span>
        </div>

        {/* Formulaire d'exclusion */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-800">Exclure un membre</h2>

          <form onSubmit={handleExcludeMember} className="space-y-4">
            <div>
              <label htmlFor="excluded-user-id" className="block text-sm text-gray-700 mb-1">
                Identifiant de l'utilisateur <span className="text-red-500">*</span>
              </label>
              <input
                id="excluded-user-id"
                type="text"
                required
                value={excludedUserId}
                onChange={(e) => setExcludedUserId(e.target.value)}
                placeholder="UUID de l'utilisateur à exclure"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isExcluding}
              />
            </div>
            <div>
              <label htmlFor="exclusion-reason" className="block text-sm text-gray-700 mb-1">
                Motif (optionnel)
              </label>
              <input
                id="exclusion-reason"
                type="text"
                value={exclusionReason}
                onChange={(e) => setExclusionReason(e.target.value)}
                placeholder="ex: comportement non conforme aux règles"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={isExcluding}
              />
            </div>

            {exclusionError && <p className="text-red-600 text-sm">{exclusionError}</p>}
            {exclusionSuccess && <p className="text-green-600 text-sm">{exclusionSuccess}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isExcluding}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isExcluding ? 'Exclusion…' : 'Exclure le membre'}
              </button>
            </div>
          </form>
        </div>

        {/* Historique des exclusions */}
        {exclusionList.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-gray-800">
              Exclusions effectuées cette session
            </h2>
            <ul className="space-y-2">
              {exclusionList.map((exclusion) => (
                <li
                  key={exclusion.id}
                  className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800"
                >
                  <span className="font-mono text-xs">{exclusion.excludedUserId}</span>
                  {exclusion.reason && (
                    <span className="ml-2 text-red-600">— {exclusion.reason}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  )
}
