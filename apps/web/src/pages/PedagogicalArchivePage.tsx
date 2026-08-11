/**
 * PedagogicalArchivePage — « Stats / Archives » (`/archives`, `/archives/:personId`)
 *
 * Un seul écran, une seule question posée à l'utilisateur : **qui consulte-t-on ?**
 * Soi-même par défaut ; les personnes reliées ensuite, listées par prénom et nom
 * grâce à `GET /relations/my-contacts` — un appel valable pour tous les rôles, là
 * où l'ancien `fetchLinkedStudents(user.id)` n'interrogeait que la table
 * financeur↔élève et servait une liste vide, sans message, à un formateur.
 *
 * Le droit appartient au serveur (`profile-service` pour les statistiques,
 * `archive-document-service` pour les archives). Le front choisit seulement ce
 * qu'il montre : les onglets d'archives sont retirés quand la nature du lien ne les
 * ouvre pas — un élève voit les statistiques de son formateur, jamais ses archives.
 *
 * Chargement : au montage de la page, puis à chaque **changement de personne
 * consultée** — changer de sujet est une navigation légitime, changer d'onglet non.
 * Les panneaux sont montés à leur première activation et restent montés (`TabPanel`).
 */

import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { downloadArchiveDocument } from '../api/archiveDocument'
import { usePedagogicalArchives } from '../hooks/archive/usePedagogicalArchives'
import { useMyContacts } from '../hooks/relations/useMyContacts'
import { usePersonDisplayName } from '../hooks/profile/usePersonDisplayName'
import ArchiveTimeline from '../components/archive/ArchiveTimeline'
import ArchiveItemDetail from '../components/archive/ArchiveItemDetail'
import CourseSummaryArchiveView from '../components/archive/CourseSummaryArchiveView'
import PersonScopeSelector from '../components/archive/PersonScopeSelector'
import ProfileStatisticsPanel from '../components/profile/ProfileStatisticsPanel'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { Tabs, TabPanel, type TabDefinition } from '../components/ui/Tabs'
import { getErrorMessage } from '../utils/apiError'
import { canRelationsOpenArchives } from '../utils/relationAccess'

type ArchiveTabId = 'statistics' | 'timeline' | 'summaries'

const STATISTICS_TAB: TabDefinition = { id: 'statistics', label: 'Statistiques' }
const ARCHIVE_TABS: TabDefinition[] = [
  { id: 'timeline', label: 'Archives' },
  { id: 'summaries', label: 'Résumés de cours' },
]

export default function PedagogicalArchivePage() {
  const { personId: personIdFromUrl } = useParams<{ personId: string }>()
  const { user, hasRole } = useAuth()

  const selfUserId = user?.id ?? ''
  const { displayName: selfDisplayName } = usePersonDisplayName(selfUserId, 'Mon espace')

  const [selectedPersonId, setSelectedPersonId] = useState<string>(personIdFromUrl ?? '')
  const consultedPersonId = selectedPersonId || selfUserId

  const {
    contacts,
    isLoading: isLoadingContacts,
    error: contactsError,
  } = useMyContacts()
  const {
    archiveItems,
    timelineGroups,
    isLoading: isLoadingArchives,
    error: archivesError,
  } = usePedagogicalArchives(consultedPersonId)

  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isDownloadingDocument, setIsDownloadingDocument] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ArchiveTabId>('statistics')

  // Le parent financeur n'accède jamais au carnet personnel de son élève.
  const canAccessNotebook = !hasRole('parent_financeur')

  const consultedContact = contacts.find((contact) => contact.userId === consultedPersonId)
  const isViewingOwnData = consultedPersonId === selfUserId
  const canConsultArchives =
    isViewingOwnData || canRelationsOpenArchives(consultedContact?.relations ?? [], user?.role)

  const visibleTabs = canConsultArchives ? [STATISTICS_TAB, ...ARCHIVE_TABS] : [STATISTICS_TAB]
  const effectiveTab: ArchiveTabId = visibleTabs.some((tab) => tab.id === activeTab)
    ? activeTab
    : 'statistics'

  const handleSelectPerson = (personId: string) => {
    setSelectedPersonId(personId)
    setSelectedItemId(null)
    setDownloadError(null)
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

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stats / Archives</h1>
          <p className="text-gray-500 text-sm mt-1">
            Statistiques de progression et historique des activités pédagogiques.
          </p>
        </div>

        <PersonScopeSelector
          selfDisplayName={selfDisplayName ?? 'Mon espace'}
          contacts={contacts}
          selectedUserId={consultedPersonId}
          selfUserId={selfUserId}
          onSelectPerson={handleSelectPerson}
          isLoadingContacts={isLoadingContacts}
          contactsError={contactsError}
        />

        <Tabs
          tabs={visibleTabs}
          activeTab={effectiveTab}
          onTabChange={(tabId) => setActiveTab(tabId as ArchiveTabId)}
          ariaLabel="Statistiques et archives"
        />

        {archivesError && <ErrorMessage message={archivesError} />}

        <TabPanel tabId="statistics" activeTab={effectiveTab}>
          <ProfileStatisticsPanel userId={consultedPersonId} />
        </TabPanel>

        <TabPanel tabId="timeline" activeTab={effectiveTab}>
          {isLoadingArchives ? (
            <p className="text-gray-400 text-sm">Chargement des archives…</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-4">Historique</h2>
                <ArchiveTimeline
                  timelineGroups={timelineGroups}
                  onSelectItem={setSelectedItemId}
                  selectedItemId={selectedItemId}
                />
              </div>

              <div className="space-y-3">
                {downloadError && (
                  <ErrorMessage message={downloadError} onClose={() => setDownloadError(null)} />
                )}
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
                      Sélectionnez un élément de l'historique pour afficher son détail.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </TabPanel>

        <TabPanel tabId="summaries" activeTab={effectiveTab}>
          {isLoadingArchives ? (
            <p className="text-gray-400 text-sm">Chargement des archives…</p>
          ) : (
            <CourseSummaryArchiveView allArchiveItems={archiveItems} />
          )}
        </TabPanel>
      </div>
    </Layout>
  )
}
