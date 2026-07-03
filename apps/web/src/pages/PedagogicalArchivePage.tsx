/**
 * PedagogicalArchivePage — Phase 11 (archive-document-service)
 *
 * Affiche l'historique pédagogique archivé d'un élève.
 * Composition :
 *   - ArchiveTimeline : liste chronologique cliquable (panneau gauche)
 *   - ArchiveItemDetail : détail de l'élément sélectionné (panneau droit)
 *   - CourseSummaryArchiveView : onglet filtré sur les résumés de cours
 *
 * Règles d'accès :
 *   - Élève : voit tout sauf les pages hiddenFromStudent
 *   - Parent financeur : voit tout SAUF le carnet personnel (notebook_entry)
 *   - Formateur, RP, AP, TI : accès complet
 *
 * Routes API consommées :
 *   GET /students/:studentId/pedagogical-archives
 *   GET /students/:studentId/archive-timeline
 *   GET /archive-documents/:id/download
 */

import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import {
  fetchPedagogicalArchives,
  fetchArchiveTimeline,
  downloadArchiveDocument,
  type PedagogicalArchiveItem,
  type ArchiveTimelineEntry,
} from '../api/archiveDocument'
import ArchiveTimeline from '../components/archive/ArchiveTimeline'
import ArchiveItemDetail from '../components/archive/ArchiveItemDetail'
import CourseSummaryArchiveView from '../components/archive/CourseSummaryArchiveView'
import ProfileStatisticsPanel from './ProfileStatisticsPanel'

type ActiveTab = 'statistics' | 'timeline' | 'summaries'

export default function PedagogicalArchivePage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { user, hasRole } = useAuth()

  const [archiveItems, setArchiveItems] = useState<PedagogicalArchiveItem[]>([])
  const [timelineEntries, setTimelineEntries] = useState<ArchiveTimelineEntry[]>([])
  const [isLoadingArchives, setIsLoadingArchives] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isDownloadingDocument, setIsDownloadingDocument] = useState(false)

  const [activeTab, setActiveTab] = useState<ActiveTab>('statistics')

  const resolvedStudentId = studentId ?? user?.id ?? ''

  // Le parent financeur ne peut pas accéder au carnet personnel
  const isParentFinanceur = hasRole('parent_financeur')
  const canAccessNotebook = !isParentFinanceur

  useEffect(() => {
    if (!resolvedStudentId) return

    setIsLoadingArchives(true)
    setLoadError(null)

    Promise.all([
      fetchPedagogicalArchives(resolvedStudentId),
      fetchArchiveTimeline(resolvedStudentId),
    ])
      .then(([fetchedArchives, fetchedTimeline]) => {
        setArchiveItems(fetchedArchives)
        setTimelineEntries(fetchedTimeline)
      })
      .catch((error) => {
        const statusCode = error?.response?.status
        if (statusCode === 403) {
          setLoadError('Accès refusé. Vous n\'êtes pas autorisé à consulter ces archives.')
        } else if (statusCode === 404) {
          setLoadError('Élève introuvable.')
        } else {
          setLoadError('Impossible de charger les archives pédagogiques.')
        }
      })
      .finally(() => setIsLoadingArchives(false))
  }, [resolvedStudentId])

  const handleSelectEntry = (entryId: string) => {
    setSelectedItemId(entryId)
  }

  const handleDownloadDocument = async (documentId: string) => {
    setIsDownloadingDocument(true)
    try {
      const blobData = await downloadArchiveDocument(documentId)
      const blobUrl = URL.createObjectURL(blobData)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = `archive-${documentId}`
      anchor.click()
      URL.revokeObjectURL(blobUrl)
    } catch {
      // non-bloquant : le téléchargement silencieux échoue sans bloquer la page
    } finally {
      setIsDownloadingDocument(false)
    }
  }

  const selectedArchiveItem = selectedItemId
    ? archiveItems.find((item) => item.id === selectedItemId) ?? null
    : null

  if (isLoadingArchives) {
    return (
      <Layout>
        <p className="text-gray-400 text-sm">Chargement des archives…</p>
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
        {/* En-tête */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stats / Archives</h1>
          <p className="text-gray-500 text-sm mt-1">
            Statistiques de progression et historique des activités pédagogiques.
          </p>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('statistics')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'statistics'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Statistiques
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'timeline'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Archives
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('summaries')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'summaries'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Résumés de cours
          </button>
        </div>

        {/* Onglet Statistiques pédagogiques */}
        {activeTab === 'statistics' && (
          <ProfileStatisticsPanel userId={resolvedStudentId} />
        )}

        {/* Onglet Archives — timeline chronologique */}
        {activeTab === 'timeline' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Panneau gauche — timeline */}
            <div>
              <h2 className="text-sm font-semibold text-gray-700 mb-4">
                Historique ({timelineEntries.length})
              </h2>
              <ArchiveTimeline
                timelineEntries={timelineEntries}
                onSelectEntry={handleSelectEntry}
                selectedEntryId={selectedItemId}
              />
            </div>

            {/* Panneau droit — détail */}
            <div>
              {selectedArchiveItem ? (
                <ArchiveItemDetail
                  archiveItem={selectedArchiveItem}
                  canAccessNotebook={canAccessNotebook}
                  isDownloadingDocument={isDownloadingDocument}
                  onDownload={handleDownloadDocument}
                />
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                  <p className="text-gray-400 text-sm">
                    Sélectionnez un élément dans la timeline pour afficher son détail.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Onglet Résumés de cours */}
        {activeTab === 'summaries' && (
          <CourseSummaryArchiveView allArchiveItems={archiveItems} />
        )}
      </div>
    </Layout>
  )
}
