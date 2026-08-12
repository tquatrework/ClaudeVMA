/**
 * LinkedStudentsSection — Zone "Mes élèves / enfants" pour le profil parent_financeur
 *
 * Trois sous-zones :
 *   1. Liste des élèves rattachés, chacun pouvant être délié (ici)
 *   2. Formulaire pour déclarer un élève (InviteStudentForm)
 *   3. Accepter/refuser les demandes student_initiated en attente (PendingStudentRequestsList)
 *
 * Strictement symétrique de `ParentFinanceurSection` : la liste, la rupture et la
 * boîte de confirmation sont partagées, seuls les libellés diffèrent.
 */

import React from 'react'
import { useFinanceOwnerStudentLinks } from '../../hooks/relations/useFinanceOwnerStudentLinks'
import { describeFinanceLinkCounterpart } from '../../utils/relationLabels'
import { FinanceOwnerStudentLinkList } from './FinanceOwnerStudentLinkList'
import { UnlinkFinanceRelationDialog } from './UnlinkFinanceRelationDialog'
import { InviteStudentForm } from './InviteStudentForm'
import { PendingStudentRequestsList } from './PendingStudentRequestsList'

interface LinkedStudentsSectionProps {
  parentId: string
}

export default function LinkedStudentsSection({ parentId }: LinkedStudentsSectionProps) {
  const {
    links: linkedStudents,
    isLoading,
    loadError,
    reload,
    pendingUnlink,
    requestUnlink,
    cancelUnlink,
    confirmUnlink,
    isUnlinking,
    unlinkError,
  } = useFinanceOwnerStudentLinks({ viewerSide: 'finance_owner', viewerId: parentId })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Mes élèves / enfants</h2>

      {/* Sous-zone 1 — Élèves rattachés */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Vos élèves rattachés</h3>
        <FinanceOwnerStudentLinkList
          links={linkedStudents}
          viewerSide="finance_owner"
          isLoading={isLoading}
          loadError={loadError}
          emptyMessage="Aucun élève rattaché pour l'instant."
          onUnlinkRequested={requestUnlink}
        />
      </div>

      {/* Sous-zone 2 — Déclarer un élève */}
      <InviteStudentForm />

      {/* Sous-zone 3 — Demandes student_initiated en attente */}
      <PendingStudentRequestsList onApproved={reload} />

      {pendingUnlink && (
        <UnlinkFinanceRelationDialog
          counterpartName={describeFinanceLinkCounterpart(pendingUnlink, 'finance_owner')}
          viewerSide="finance_owner"
          isSubmitting={isUnlinking}
          errorMessage={unlinkError}
          onConfirm={confirmUnlink}
          onCancel={cancelUnlink}
        />
      )}
    </div>
  )
}
