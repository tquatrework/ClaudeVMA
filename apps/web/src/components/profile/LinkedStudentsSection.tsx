/**
 * LinkedStudentsSection — Zone "Mes élèves / enfants" pour le profil parent_financeur
 *
 * Trois sous-zones :
 *   1. Liste des élèves rattachés (ici)
 *   2. Formulaire pour déclarer un élève (InviteStudentForm)
 *   3. Accepter/refuser les demandes student_initiated en attente (PendingStudentRequestsList)
 */

import React, { useEffect, useState, useCallback } from 'react'
import { fetchLinkedStudents, fetchStudentProfile, type FinanceOwnerStudentLink } from '../../api/relations'
import { InviteStudentForm } from './InviteStudentForm'
import { PendingStudentRequestsList } from './PendingStudentRequestsList'

interface LinkedStudentsSectionProps {
  parentId: string
}

function formatFullName(
  firstName?: string,
  lastName?: string,
  loginIdentifier?: string | null,
  fallbackId?: string,
): string {
  if (firstName || lastName) {
    return [firstName, lastName].filter(Boolean).join(' ')
  }
  if (loginIdentifier) return loginIdentifier
  return fallbackId ? `Élève (${fallbackId.slice(0, 8)}…)` : 'Élève inconnu'
}

export default function LinkedStudentsSection({ parentId }: LinkedStudentsSectionProps) {
  // Sous-zone 1 — élèves rattachés
  const [linkedStudents, setLinkedStudents] = useState<FinanceOwnerStudentLink[]>([])
  const [studentDisplayNames, setStudentDisplayNames] = useState<Record<string, string>>({})
  const [isLoadingLinkedStudents, setIsLoadingLinkedStudents] = useState(true)
  const [linkedStudentsError, setLinkedStudentsError] = useState<string | null>(null)

  const loadLinkedStudents = useCallback(async () => {
    setIsLoadingLinkedStudents(true)
    setLinkedStudentsError(null)
    try {
      const students = await fetchLinkedStudents(parentId)
      setLinkedStudents(students)

      // Enrichissement : récupérer prénom + nom de chaque élève via GET /profiles/:id
      const displayNames: Record<string, string> = {}
      await Promise.allSettled(
        students.map(async (link) => {
          try {
            const profile = await fetchStudentProfile(link.studentId)
            displayNames[link.studentId] = formatFullName(
              profile.administrativeProfile?.firstName,
              profile.administrativeProfile?.lastName,
              profile.loginIdentifier,
              link.studentId,
            )
          } catch {
            displayNames[link.studentId] = formatFullName(
              undefined,
              undefined,
              undefined,
              link.studentId,
            )
          }
        }),
      )
      setStudentDisplayNames(displayNames)
    } catch {
      setLinkedStudentsError('Impossible de charger vos élèves rattachés.')
    } finally {
      setIsLoadingLinkedStudents(false)
    }
  }, [parentId])

  useEffect(() => {
    loadLinkedStudents()
  }, [loadLinkedStudents])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Mes élèves / enfants</h2>

      {/* Sous-zone 1 — Élèves rattachés */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-3">Vos élèves rattachés</h3>
        {isLoadingLinkedStudents ? (
          <p className="text-sm text-gray-400">Chargement…</p>
        ) : linkedStudentsError ? (
          <p className="text-sm text-red-600">{linkedStudentsError}</p>
        ) : linkedStudents.length === 0 ? (
          <p className="text-sm text-gray-400">Aucun élève rattaché pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {linkedStudents.map((link) => (
              <li
                key={link.studentId}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
              >
                <span className="text-sm text-gray-800 font-medium">
                  {studentDisplayNames[link.studentId] ?? formatFullName(undefined, undefined, undefined, link.studentId)}
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

      {/* Sous-zone 2 — Déclarer un élève */}
      <InviteStudentForm />

      {/* Sous-zone 3 — Demandes student_initiated en attente */}
      <PendingStudentRequestsList onApproved={loadLinkedStudents} />
    </div>
  )
}
