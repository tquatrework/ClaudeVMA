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
 *
 * Gestion des erreurs : 403 et erreurs génériques bloquent la page (message plein-page).
 * 404 = "pas encore d'archives" (non documenté comme "élève introuvable" dans
 * docs/routes.md) : ne bloque PAS la page, chaque onglet affiche son état vide.
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
import { fetchLinkedStudents, fetchStudentProfile, type FinanceOwnerStudentLink } from '../api/relations'
import ArchiveTimeline from '../components/archive/ArchiveTimeline'
import ArchiveItemDetail from '../components/archive/ArchiveItemDetail'
import CourseSummaryArchiveView from '../components/archive/CourseSummaryArchiveView'
import ProfileStatisticsPanel from './ProfileStatisticsPanel'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { getErrorMessage } from '../utils/apiError'
import { ArchiveTabsNav, type ArchiveActiveTab } from '../components/archive/ArchiveTabsNav'

interface StudentOption {
  studentId: string
  displayName: string
}

type ActiveTab = ArchiveActiveTab

export default function PedagogicalArchivePage() {
  const { studentId } = useParams<{ studentId: string }>()
  const { user, hasRole } = useAuth()

  const [archiveItems, setArchiveItems] = useState<PedagogicalArchiveItem[]>([])
  const [timelineEntries, setTimelineEntries] = useState<ArchiveTimelineEntry[]>([])
  const [isLoadingArchives, setIsLoadingArchives] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isDownloadingDocument, setIsDownloadingDocument] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<ActiveTab>('statistics')

  // Le parent financeur ne peut pas accéder au carnet personnel
  const isParentFinanceur = hasRole('parent_financeur')
  const canAccessNotebook = !isParentFinanceur

  // Sélecteur d'élève pour parent_financeur (quand pas de studentId en URL)
  const [linkedStudentOptions, setLinkedStudentOptions] = useState<StudentOption[]>([])
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')
  const [isLoadingStudentOptions, setIsLoadingStudentOptions] = useState(false)

  const resolvedStudentId = studentId ?? (isParentFinanceur ? selectedStudentId : user?.id ?? '')

  // Chargement des élèves liés si parent sans studentId en URL
  useEffect(() => {
    if (!isParentFinanceur || studentId || !user?.id) return

    setIsLoadingStudentOptions(true)
    fetchLinkedStudents(user.id)
      .then(async (links: FinanceOwnerStudentLink[]) => {
        const options: StudentOption[] = await Promise.all(
          links.map(async (link) => {
            try {
              const profile = await fetchStudentProfile(link.studentId)
              const adminProfile = profile.administrative
              const displayName =
                adminProfile?.firstName && adminProfile?.lastName
                  ? `${adminProfile.firstName} ${adminProfile.lastName}`
                  : profile.loginIdentifier ?? `ELV-${link.studentId.slice(0, 8)}`
              return { studentId: link.studentId, displayName }
            } catch {
              return { studentId: link.studentId, displayName: `ELV-${link.studentId.slice(0, 8)}` }
            }
          }),
        )
        setLinkedStudentOptions(options)
        if (options.length > 0) {
          setSelectedStudentId(options[0].studentId)
        }
      })
      .catch(() => {
        // non-bloquant : si le chargement échoue, le sélecteur reste vide
      })
      .finally(() => setIsLoadingStudentOptions(false))
  }, [isParentFinanceur, studentId, user?.id])

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
          // 404 = pas encore d'archives (voir commentaire d'en-tête) : pas de blocage.
          setArchiveItems([])
          setTimelineEntries([])
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
    setDownloadError(null)
    try {
      const blobData = await downloadArchiveDocument(documentId)
      const blobUrl = URL.createObjectURL(blobData)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = `archive-${documentId}`
      anchor.click()
      URL.revokeObjectURL(blobUrl)
    } catch (error: unknown) {
      // Non-bloquant : la page reste utilisable, l'échec est juste rendu visible.
      setDownloadError(getErrorMessage(error, 'Impossible de télécharger ce document.'))
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
        <ErrorMessage message={loadError} />
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

        {/* Sélecteur d'élève pour parent_financeur sans studentId en URL */}
        {isParentFinanceur && !studentId && (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            {isLoadingStudentOptions ? (
              <p className="text-sm text-gray-400">Chargement des élèves rattachés…</p>
            ) : linkedStudentOptions.length === 0 ? (
              <p className="text-sm text-gray-400">
                Aucun élève rattaché. Rattachez un élève depuis votre profil pour accéder à ses archives.
              </p>
            ) : (
              <div className="flex items-center gap-3">
                <label htmlFor="studentSelector" className="text-sm font-medium text-gray-700 shrink-0">
                  Élève consulté :
                </label>
                <select
                  id="studentSelector"
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 flex-1 max-w-xs"
                >
                  {linkedStudentOptions.map((option) => (
                    <option key={option.studentId} value={option.studentId}>
                      {option.displayName}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Onglets */}
        <ArchiveTabsNav activeTab={activeTab} onTabChange={setActiveTab} />

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
            <div className="space-y-3">
              {downloadError && <ErrorMessage message={downloadError} onClose={() => setDownloadError(null)} />}
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
