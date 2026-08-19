/**
 * CourseProposalsPanel — onglet « Propositions de cours » de `/calendar` (chantier calendrier
 * de disponibilités, point 3). Permet à un formateur, un animateur pédagogique ou un
 * responsable pédagogique d'ouvrir `ProposeCourseSlotDialog` et de suivre ses propositions
 * envoyées depuis cet appareil.
 *
 * **Rôle révisé le 2026-08-19.** Le gap qui justifiait cet onglet côté **destinataire** est
 * comblé : `GET /calendars/:ownerId` porte désormais `activities`, et une proposition reçue
 * s'affiche directement dans la grille de l'onglet « Mes disponibilités »
 * (`AvailabilityTab`), avec ses boutons Accepter/Refuser inline — plus besoin de connaître un
 * lien direct transmis hors application. Cet onglet reste néanmoins le point d'entrée du
 * **proposeur** : ouvrir `ProposeCourseSlotDialog`, et un suivi de ce qu'il a envoyé.
 *
 * **Limite assumée, inchangée** (voir `useSentCourseProposals`) : ce suivi ne retrace que les
 * propositions envoyées **depuis ce navigateur** (`localStorage`, aucune route de liste
 * globale côté serveur). `GET /calendars/:ownerId` inclurait bien les activités où l'utilisateur
 * est *créateur*, mais sa forme (`CalendarActivityEntry`) ne porte ni `title` ni le nom du
 * destinataire — y migrer ferait perdre le titre affiché ici sans le remplacer par une
 * information équivalente ; non fait pour cette raison, voir le rapport de session.
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import type { UserRole } from '../../context/AuthContext'
import { useSentCourseProposals } from '../../hooks/calendar/useSentCourseProposals'
import {
  ACTIVITY_STATUS_BADGE_CLASSES,
  getActivityStatusLabel,
  getActivityTypeLabel,
} from '../../utils/activityLabels'
import type { ScheduledActivity } from '../../types/calendar'
import { StatusBadge } from '../ui/StatusBadge'
import { ErrorMessage } from '../ui/ErrorMessage'
import ProposeCourseSlotDialog, { type CourseProposerRole } from './ProposeCourseSlotDialog'

function resolveProposerRole(hasRole: (...roles: UserRole[]) => boolean): CourseProposerRole | null {
  if (hasRole('formateur')) return 'formateur'
  if (hasRole('animateur_pedagogique')) return 'animateur_pedagogique'
  if (hasRole('responsable_pedagogique')) return 'responsable_pedagogique'
  return null
}

function formatDateRange(startTime: string, endTime: string): string {
  const start = new Date(startTime)
  const end = new Date(endTime)
  return `${start.toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })} → ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function CourseProposalsPanel() {
  const { user, hasRole } = useAuth()
  const proposerRole = resolveProposerRole(hasRole)

  const { proposals, isLoading, loadError, refetch, addProposal } = useSentCourseProposals(user?.id)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const handleCreated = (activity: ScheduledActivity) => {
    addProposal(activity)
    setIsDialogOpen(false)
    setSuccessMessage('Votre proposition de créneau a bien été envoyée.')
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Mes propositions envoyées</h2>
          <p className="text-sm text-gray-500 mt-1">
            Suivi des créneaux que vous avez proposés depuis cet appareil.
          </p>
        </div>
        {proposerRole && (
          <button
            type="button"
            onClick={() => setIsDialogOpen(true)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors shrink-0"
          >
            Proposer un créneau
          </button>
        )}
      </div>

      {successMessage && (
        <ErrorMessage
          message={successMessage}
          variant="success"
          onClose={() => setSuccessMessage(null)}
          className="mb-4"
        />
      )}

      {loadError && <ErrorMessage message={loadError} className="mb-4" />}

      {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}

      {!isLoading && !loadError && proposals.length === 0 && (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-400 text-sm font-medium">
            Aucune proposition envoyée pour l'instant.
          </p>
          {!proposerRole && (
            <p className="text-gray-400 text-xs mt-1">
              Les propositions de créneau que vous recevez s'affichent dans l'onglet « Mes
              disponibilités », avec leurs boutons Accepter/Refuser.
            </p>
          )}
        </div>
      )}

      {proposals.length > 0 && (
        <ul className="space-y-3">
          {proposals.map((proposal) => (
            <li key={proposal.id}>
              <Link
                to={`/calendar/proposals/${proposal.id}`}
                className="block p-4 border border-gray-200 rounded-xl bg-white hover:border-indigo-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-800">
                      {proposal.title ?? getActivityTypeLabel(proposal.type)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDateRange(proposal.startTime, proposal.endTime)}
                    </p>
                  </div>
                  <StatusBadge
                    status={proposal.status}
                    label={getActivityStatusLabel(proposal.status)}
                    badgeClasses={ACTIVITY_STATUS_BADGE_CLASSES}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {proposals.length > 0 && (
        <button
          type="button"
          onClick={refetch}
          className="mt-3 text-xs text-indigo-600 hover:underline"
        >
          Actualiser les statuts
        </button>
      )}

      {isDialogOpen && proposerRole && (
        <ProposeCourseSlotDialog
          proposerRole={proposerRole}
          onCreated={handleCreated}
          onClose={() => setIsDialogOpen(false)}
        />
      )}
    </div>
  )
}
