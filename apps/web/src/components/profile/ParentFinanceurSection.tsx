/**
 * ParentFinanceurSection — Zone "Parents financeurs" pour le profil élève
 *
 * Trois sous-zones :
 *   1. Liste des parents financeurs rattachés, chacun pouvant être délié (ici)
 *   2. Formulaire pour inviter un parent (InviteParentForm)
 *   3. Accepter/refuser les invitations de parents en attente (PendingParentInvitationsList)
 *
 * Strictement symétrique de `LinkedStudentsSection` : la liste, la rupture et la
 * boîte de confirmation sont partagées, seuls les libellés diffèrent.
 */

import React from 'react'
import { useFinanceOwnerStudentLinks } from '../../hooks/relations/useFinanceOwnerStudentLinks'
import { describeFinanceLinkCounterpart } from '../../utils/relationLabels'
import { FinanceOwnerStudentLinkList } from './FinanceOwnerStudentLinkList'
import { UnlinkFinanceRelationDialog } from './UnlinkFinanceRelationDialog'
import { InviteParentForm } from './InviteParentForm'
import { PendingParentInvitationsList } from './PendingParentInvitationsList'

interface ParentFinanceurSectionProps {
  studentId: string
}

export default function ParentFinanceurSection({ studentId }: ParentFinanceurSectionProps) {
  const {
    links: linkedParents,
    isLoading,
    loadError,
    reload,
    pendingUnlink,
    requestUnlink,
    cancelUnlink,
    confirmUnlink,
    isUnlinking,
    unlinkError,
  } = useFinanceOwnerStudentLinks({ viewerSide: 'student', viewerId: studentId })

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Parents financeurs</h2>

      {/* Sous-zone 1 — Parents rattachés */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Vos parents financeurs</h3>
        <FinanceOwnerStudentLinkList
          links={linkedParents}
          viewerSide="student"
          isLoading={isLoading}
          loadError={loadError}
          emptyMessage="Aucun parent financeur rattaché pour l'instant."
          onUnlinkRequested={requestUnlink}
        />
      </div>

      {/* Sous-zone 2 — Déclarer un parent financeur */}
      <InviteParentForm />

      {/* Sous-zone 3 — Invitations de parents en attente */}
      <PendingParentInvitationsList onApproved={reload} />

      {pendingUnlink && (
        <UnlinkFinanceRelationDialog
          counterpartName={describeFinanceLinkCounterpart(pendingUnlink, 'student')}
          viewerSide="student"
          isSubmitting={isUnlinking}
          errorMessage={unlinkError}
          onConfirm={confirmUnlink}
          onCancel={cancelUnlink}
        />
      )}
    </div>
  )
}
