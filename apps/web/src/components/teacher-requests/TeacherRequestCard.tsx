/**
 * TeacherRequestCard — une demande dans une liste.
 *
 * Le libellé principal est le **nom de l'élève**, résolu par le serveur (`studentName`),
 * jamais « Demande #c4fcaae5 » ni « Élève : 9c7b7836… » : un UUID tronqué n'est pas un
 * nom (arbitrage du 2026-08-09). Le statut passe par le point unique de libellés.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import type { TeacherRequest } from '../../types/teacherRequests'
import { formatLongDate } from '../../utils/dateFormat'
import {
  getTeacherRequestStatusColor,
  getTeacherRequestStatusLabel,
  getTeacherRequestTitle,
} from '../../utils/teacherRequestLabels'
import { StatusBadge } from '../ui/StatusBadge'

interface TeacherRequestCardProps {
  request: TeacherRequest
  /** Affiche le décompte des réponses — renseigné par le serveur pour le RP seul. */
  showProposalCounts?: boolean
}

export default function TeacherRequestCard({
  request,
  showProposalCounts = false,
}: TeacherRequestCardProps) {
  const acceptedCount = request.acceptedProposalCount ?? 0
  const pendingCount = request.pendingProposalCount ?? 0

  return (
    <Link
      to={`/teacher-requests/${request.id}`}
      className="block p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-gray-800">
          {getTeacherRequestTitle(request.studentName)}
        </span>
        <StatusBadge
          status={request.status}
          label={getTeacherRequestStatusLabel(request.status)}
          className={getTeacherRequestStatusColor(request.status)}
        />
      </div>

      <p className="mt-1 text-xs text-gray-500 line-clamp-2">{request.description}</p>

      {request.chosenTeacherName && (
        <p className="mt-2 text-xs text-green-700">
          Professeur retenu : {request.chosenTeacherName}
        </p>
      )}

      {showProposalCounts && (acceptedCount > 0 || pendingCount > 0) && (
        <p className="mt-2 text-xs text-gray-500">
          {acceptedCount} acceptation{acceptedCount > 1 ? 's' : ''} · {pendingCount} sans
          réponse
        </p>
      )}

      <p className="mt-2 text-xs text-gray-400">{formatLongDate(request.createdAt)}</p>
    </Link>
  )
}
