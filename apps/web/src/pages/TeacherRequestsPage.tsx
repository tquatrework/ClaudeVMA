/**
 * TeacherRequestsPage — `/teacher-requests`, point d'entrée unique du flow
 * « demande de professeur ».
 *
 * Une seule page pour un même domaine : `TeacherRequestPage` (`/rp/teacher-requests`)
 * en était un doublon, avec un second formulaire postant un autre corps sur la même
 * route, et rechargeait `GET /teacher-requests` trois fois par montage.
 *
 * La forme dépend du rôle, comme la réponse du serveur :
 *   - élève, parent financeur, RP → leurs demandes, ouvertes ou clôturées ;
 *   - formateur → sa boîte de réception de propositions.
 *
 * Chargement au niveau de la page, un appel par portée (arbitrage du 2026-08-10).
 */

import React, { useState } from 'react'
import Layout from '../components/Layout'
import { useAuth } from '../hooks/useAuth'
import { useMyContacts } from '../hooks/relations/useMyContacts'
import { useTeacherProposalInbox } from '../hooks/teacher-requests/useTeacherProposalInbox'
import { useTeacherRequestList } from '../hooks/teacher-requests/useTeacherRequestList'
import { selectFinancedStudents } from '../utils/contactSelectors'
import type { TeacherRequestScope } from '../types/teacherRequests'
import ChangePrincipalTeacherDialog from '../components/teacher-requests/ChangePrincipalTeacherDialog'
import TeacherProposalInbox from '../components/teacher-requests/TeacherProposalInbox'
import TeacherRequestCard from '../components/teacher-requests/TeacherRequestCard'
import TeacherRequestForm from '../components/teacher-requests/TeacherRequestForm'
import RpWorkQueueNav from '../components/teacher-requests/RpWorkQueueNav'
import { ErrorMessage } from '../components/ui/ErrorMessage'
import { PageHeader } from '../components/ui/PageHeader'

const SCOPE_TABS: ReadonlyArray<{ value: TeacherRequestScope; label: string }> = [
  { value: 'open', label: 'En cours' },
  { value: 'closed', label: 'Traitées' },
]

export default function TeacherRequestsPage() {
  const { hasRole } = useAuth()

  const isFormateur = hasRole('formateur')
  const isEleve = hasRole('eleve')
  const isParentFinanceur = hasRole('parent_financeur')
  const isResponsablePedagogique = hasRole('responsable_pedagogique')

  const [scope, setScope] = useState<TeacherRequestScope>('open')

  return (
    <Layout>
      <div className="max-w-3xl space-y-6">
        {isFormateur ? (
          <TeacherInboxSection scope={scope} onScopeChange={setScope} />
        ) : (
          <TeacherRequestsSection
            scope={scope}
            onScopeChange={setScope}
            isEleve={isEleve}
            isParentFinanceur={isParentFinanceur}
            isResponsablePedagogique={isResponsablePedagogique}
          />
        )}
      </div>
    </Layout>
  )
}

// ─── Vue formateur ────────────────────────────────────────────────────────────

function ScopeTabs({
  scope,
  onScopeChange,
}: {
  scope: TeacherRequestScope
  onScopeChange: (scope: TeacherRequestScope) => void
}) {
  return (
    <div className="flex gap-2">
      {SCOPE_TABS.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onScopeChange(tab.value)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${
            scope === tab.value
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}

function TeacherInboxSection({
  scope,
  onScopeChange,
}: {
  scope: TeacherRequestScope
  onScopeChange: (scope: TeacherRequestScope) => void
}) {
  const inbox = useTeacherProposalInbox(scope)

  return (
    <>
      <PageHeader
        title="Propositions reçues"
        subtitle="Demandes d'élèves que le responsable pédagogique vous adresse."
        action={<ScopeTabs scope={scope} onScopeChange={onScopeChange} />}
      />
      <TeacherProposalInbox
        proposals={inbox.proposals}
        isLoading={inbox.isLoading}
        loadError={inbox.loadError}
        respondingProposalId={inbox.respondingProposalId}
        respondError={inbox.respondError}
        onClearRespondError={inbox.clearRespondError}
        successMessage={inbox.successMessage}
        onClearSuccessMessage={inbox.clearSuccessMessage}
        onRespond={inbox.respond}
      />
    </>
  )
}

// ─── Vue élève, parent financeur et RP ────────────────────────────────────────

interface TeacherRequestsSectionProps {
  scope: TeacherRequestScope
  onScopeChange: (scope: TeacherRequestScope) => void
  isEleve: boolean
  isParentFinanceur: boolean
  isResponsablePedagogique: boolean
}

function TeacherRequestsSection({
  scope,
  onScopeChange,
  isEleve,
  isParentFinanceur,
  isResponsablePedagogique,
}: TeacherRequestsSectionProps) {
  const {
    requests,
    isLoading,
    loadError,
    submitRequest,
    isSubmitting,
    submitError,
    clearSubmitError,
  } = useTeacherRequestList(scope)

  const { contacts, isLoading: isLoadingContacts, error: contactsError } = useMyContacts()
  const financedStudents = selectFinancedStudents(contacts)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isPpDialogOpen, setIsPpDialogOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Le RP instruit les demandes, il n'en crée pas : le serveur l'y autorise, mais aucun
  // annuaire d'élèves ne lui est accessible — lui offrir le formulaire reviendrait à lui
  // redemander un UUID.
  const canCreateRequest = isEleve || isParentFinanceur
  // `POST /teacher-requests/pp-change` est réservé au parent financeur : l'afficher à
  // l'élève le mènerait à un 403.
  const canRequestPpChange = isParentFinanceur && financedStudents.length > 0

  const handleSubmit = async (payload: Parameters<typeof submitRequest>[0]) => {
    const isCreated = await submitRequest(payload)
    if (isCreated) {
      setIsFormOpen(false)
      setSuccessMessage('Votre demande a bien été transmise au responsable pédagogique.')
    }
    return isCreated
  }

  return (
    <>
      <PageHeader
        title="Demandes professeur"
        subtitle={
          isResponsablePedagogique
            ? 'Demandes des élèves à instruire.'
            : 'Suivez vos demandes de professeur.'
        }
        action={
          <div className="flex gap-2 flex-wrap justify-end">
            {canCreateRequest && !isFormOpen && (
              <button
                type="button"
                onClick={() => setIsFormOpen(true)}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
              >
                Nouvelle demande
              </button>
            )}
            {canRequestPpChange && (
              <button
                type="button"
                onClick={() => setIsPpDialogOpen(true)}
                className="bg-white text-indigo-600 border border-indigo-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors"
              >
                Changer le professeur principal
              </button>
            )}
          </div>
        }
      />

      {/*
        Seconde file du plan de travail du RP : le bandeau la relie à celle des
        nouveaux formateurs. Les autres rôles n'ont qu'une file, il ne s'affiche
        donc pas pour eux.
      */}
      {isResponsablePedagogique && <RpWorkQueueNav currentPath="/teacher-requests" />}

      {successMessage && (
        <ErrorMessage
          message={successMessage}
          variant="success"
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {isFormOpen && (
        <TeacherRequestForm
          linkedStudents={financedStudents}
          isLoadingStudents={isLoadingContacts}
          studentsError={contactsError}
          isStudentRequired={isParentFinanceur}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          errorMessage={submitError}
          onClearError={clearSubmitError}
          onCancel={() => setIsFormOpen(false)}
        />
      )}

      {isPpDialogOpen && (
        <ChangePrincipalTeacherDialog
          linkedStudents={financedStudents}
          allContacts={contacts}
          onSuccess={() => {
            setIsPpDialogOpen(false)
            setSuccessMessage(
              'Votre demande de changement de professeur principal a été transmise.',
            )
          }}
          onCancel={() => setIsPpDialogOpen(false)}
        />
      )}

      <ScopeTabs scope={scope} onScopeChange={onScopeChange} />

      {loadError && <ErrorMessage message={loadError} />}

      {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

      {!isLoading && !loadError && requests.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-500 text-sm font-medium">
            {scope === 'closed'
              ? 'Aucune demande traitée pour le moment.'
              : "Vous n'avez pas pour l'instant de demande en cours."}
          </p>
          {canCreateRequest && scope === 'open' && !isFormOpen && (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="mt-3 text-indigo-600 hover:underline text-sm"
            >
              Demander un professeur
            </button>
          )}
        </div>
      )}

      <ul className="space-y-3">
        {requests.map((request) => (
          <li key={request.id}>
            <TeacherRequestCard
              request={request}
              showProposalCounts={isResponsablePedagogique}
            />
          </li>
        ))}
      </ul>
    </>
  )
}
