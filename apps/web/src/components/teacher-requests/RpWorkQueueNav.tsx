/**
 * RpWorkQueueNav — bandeau reliant les deux files de travail du responsable
 * pédagogique : les nouveaux formateurs à examiner, et les demandes de professeur
 * des élèves.
 *
 * Il rend visible leur parenté (arbitrage du 2026-08-12 : « le RP a un plan de
 * travail, pas des écrans épars ») sans les fusionner en une seule page. La liste
 * vient de `RP_WORK_QUEUES` — source unique, jamais recopiée ici.
 *
 * N'est rendu que pour le RP : ces deux files ne s'adressent qu'à lui, et une
 * entrée menant à un écran interdit ne doit pas s'afficher.
 */

import React from 'react'
import { NavLink } from 'react-router-dom'
import { RP_WORK_QUEUES } from '../../navigation/navigationConfig'

interface RpWorkQueueNavProps {
  /** Chemin de la file courante, mis en évidence. */
  currentPath: string
}

export default function RpWorkQueueNav({ currentPath }: RpWorkQueueNavProps) {
  return (
    <nav aria-label="Plan de travail" className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
        Plan de travail
      </span>
      {RP_WORK_QUEUES.map((queue) => {
        const isCurrent = queue.path === currentPath
        return (
          <NavLink
            key={queue.id}
            to={queue.path}
            aria-current={isCurrent ? 'page' : undefined}
            title={queue.description}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
              isCurrent
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            }`}
          >
            {queue.label}
          </NavLink>
        )
      })}
    </nav>
  )
}
