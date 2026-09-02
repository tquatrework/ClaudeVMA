/**
 * LinkedFinanceRelationsPanel — relations financières d'un tiers, en lecture seule.
 *
 * Complément du 2026-09-02 (point 3, « Contacts essentiels » — élève ↔ parents,
 * `docs/architecture.md` > « Reconstruction du rail gauche du RP ») : les deux
 * routes (`GET /relations/finance-owner-student/by-student/:studentId` et
 * `GET /relations/finance-owner-student/:financeOwnerId`) sont déjà ouvertes aux
 * rôles administratifs (RP, AF, TI) sur n'importe quel tiers, mais l'affichage
 * (`ParentFinanceurSection`/`LinkedStudentsSection`) n'était monté que sur son
 * propre profil (`showRelationsTab`), en plus d'embarquer des formulaires
 * d'invitation self-service qui n'ont pas de sens depuis la fiche d'un tiers.
 *
 * Ce panneau n'est **pas** une réutilisation de `ParentFinanceurSection`/
 * `LinkedStudentsSection` : il n'affiche que la liste (`FinanceOwnerStudentLinkList`,
 * sans `onUnlinkRequested` — lecture seule), sans formulaire d'invitation ni
 * demandes en attente. On ne sait pas d'avance si le titulaire consulté est un
 * élève ou un parent financeur (aucun champ de rôle sur `GET /profiles/:userId`) :
 * les deux sens sont donc interrogés et affichés côte à côte, exactement comme
 * `LinkedTeachersPanel` (élève → professeurs) est déjà affiché sur n'importe quel
 * profil sans présupposer le rôle réel du titulaire — vide et sans effet quand la
 * direction ne s'applique pas.
 */

import React from 'react'
import { useFinanceOwnerStudentLinks } from '../../hooks/relations/useFinanceOwnerStudentLinks'
import { FinanceOwnerStudentLinkList } from './FinanceOwnerStudentLinkList'

interface LinkedFinanceRelationsPanelProps {
  /** Identifiant du tiers consulté — jamais l'utilisateur connecté lui-même. */
  userId: string
}

export function LinkedFinanceRelationsPanel({ userId }: LinkedFinanceRelationsPanelProps) {
  const parents = useFinanceOwnerStudentLinks({ viewerSide: 'student', viewerId: userId })
  const students = useFinanceOwnerStudentLinks({ viewerSide: 'finance_owner', viewerId: userId })

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Parents financeurs</h2>
        <FinanceOwnerStudentLinkList
          links={parents.links}
          viewerSide="student"
          isLoading={parents.isLoading}
          loadError={parents.loadError}
          emptyMessage="Aucun parent financeur rattaché"
        />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Élèves rattachés</h2>
        <FinanceOwnerStudentLinkList
          links={students.links}
          viewerSide="finance_owner"
          isLoading={students.isLoading}
          loadError={students.loadError}
          emptyMessage="Aucun élève rattaché"
        />
      </div>
    </div>
  )
}
