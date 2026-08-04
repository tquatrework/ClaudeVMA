/**
 * ParentFinanceurSection — Zone "Parents financeurs" pour le profil élève
 *
 * Trois sous-zones :
 *   1. Liste des parents financeurs rattachés (ici)
 *   2. Formulaire pour inviter un parent (InviteParentForm)
 *   3. Accepter/refuser les invitations de parents en attente (PendingParentInvitationsList)
 */

import React, { useEffect, useState, useCallback } from 'react'
import { fetchLinkedParents, fetchStudentProfile, type FinanceOwnerStudentLink } from '../../api/relations'
import { formatPersonDisplayName } from '../../utils/nameFormat'
import { InviteParentForm } from './InviteParentForm'
import { PendingParentInvitationsList } from './PendingParentInvitationsList'

interface ParentFinanceurSectionProps {
  studentId: string
}

const FINANCE_OWNER_GENERIC_LABEL = 'Financeur'

export default function ParentFinanceurSection({ studentId }: ParentFinanceurSectionProps) {
  // Sous-zone 1 — parents rattachés
  const [linkedParents, setLinkedParents] = useState<FinanceOwnerStudentLink[]>([])
  const [parentDisplayNames, setParentDisplayNames] = useState<Record<string, string>>({})
  const [isLoadingLinkedParents, setIsLoadingLinkedParents] = useState(true)
  const [linkedParentsError, setLinkedParentsError] = useState<string | null>(null)

  const loadLinkedParents = useCallback(async () => {
    setIsLoadingLinkedParents(true)
    setLinkedParentsError(null)
    try {
      const parents = await fetchLinkedParents(studentId)
      setLinkedParents(parents)

      // Enrichissement : récupérer prénom + nom de chaque parent via GET /profiles/:id
      const displayNames: Record<string, string> = {}
      await Promise.allSettled(
        parents.map(async (link) => {
          try {
            const profile = await fetchStudentProfile(link.financeOwnerId)
            displayNames[link.financeOwnerId] = formatPersonDisplayName(
              profile.administrativeProfile?.firstName,
              profile.administrativeProfile?.lastName,
              profile.loginIdentifier,
              link.financeOwnerId,
              FINANCE_OWNER_GENERIC_LABEL,
            )
          } catch {
            displayNames[link.financeOwnerId] = formatPersonDisplayName(
              undefined,
              undefined,
              undefined,
              link.financeOwnerId,
              FINANCE_OWNER_GENERIC_LABEL,
            )
          }
        }),
      )
      setParentDisplayNames(displayNames)
    } catch {
      setLinkedParentsError('Impossible de charger vos parents financeurs.')
    } finally {
      setIsLoadingLinkedParents(false)
    }
  }, [studentId])

  useEffect(() => {
    loadLinkedParents()
  }, [loadLinkedParents])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Parents financeurs</h2>

      {/* Sous-zone 1 — Parents rattachés */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Vos parents financeurs</h3>
        {isLoadingLinkedParents ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : linkedParentsError ? (
          <p className="text-sm text-red-600">{linkedParentsError}</p>
        ) : linkedParents.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun parent financeur rattaché pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {linkedParents.map((link) => (
              <li
                key={link.financeOwnerId}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-800 font-medium">
                  {parentDisplayNames[link.financeOwnerId] ??
                    formatPersonDisplayName(
                      undefined,
                      undefined,
                      undefined,
                      link.financeOwnerId,
                      FINANCE_OWNER_GENERIC_LABEL,
                    )}
                </span>
                <span className="text-xs text-gray-400">
                  Depuis le{' '}
                  {new Date(link.createdAt).toLocaleDateString('fr-FR', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sous-zone 2 — Déclarer un parent financeur */}
      <InviteParentForm />

      {/* Sous-zone 3 — Invitations de parents en attente */}
      <PendingParentInvitationsList onApproved={loadLinkedParents} />
    </div>
  )
}
