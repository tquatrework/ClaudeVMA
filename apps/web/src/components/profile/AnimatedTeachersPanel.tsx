/**
 * AnimatedTeachersPanel — liste des formateurs animés par un animateur pédagogique
 * (AP), affichée sur la fiche de profil de cet AP.
 *
 * Complément du 2026-09-02 (point 3, « Contacts essentiels » — AP → professeurs),
 * `docs/architecture.md` > « Reconstruction du rail gauche du RP » : la route
 * (`GET /relations/animator-teacher/:animatorId`) existait déjà et est déjà ouverte
 * au RP, au TI et à l'AP lui-même, mais n'était appelée par aucun composant front.
 * Même présentation que `LinkedTeachersPanel` (élève → professeurs), en lecture
 * seule — aucune route de rupture de ce lien n'existe côté serveur, donc aucune
 * action n'est proposée ici.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import { useAnimatedTeachers } from '../../hooks/relations/useAnimatedTeachers'
import { formatPersonName } from '../../utils/nameFormat'
import { TEACHER_GENERIC_LABEL } from '../../utils/relationLabels'

interface AnimatedTeachersPanelProps {
  /** Identifiant de l'animateur pédagogique consulté. */
  animatorId: string
  /**
   * Le lecteur a-t-il, structurellement, une chance d'avoir ce droit (RP, TI, ou
   * l'AP lui-même) ? Sert uniquement à éviter un appel réseau inutile — le serveur
   * reste seul juge du droit réel.
   */
  enabled: boolean
}

export function AnimatedTeachersPanel({ animatorId, enabled }: AnimatedTeachersPanelProps) {
  const { relations, isLoading, loadError } = useAnimatedTeachers(animatorId, enabled)

  if (!enabled) return null

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Professeurs animés</h2>
      {isLoading && <p className="text-gray-400 text-sm">Chargement…</p>}
      {!isLoading && loadError && <p className="text-red-600 text-sm">{loadError}</p>}
      {!isLoading && !loadError && relations.length === 0 && (
        <p className="text-gray-400 text-sm">Aucun professeur animé</p>
      )}
      {!isLoading && !loadError && relations.length > 0 && (
        <ul className="space-y-2">
          {relations.map((relation) => (
            <li
              key={relation.id}
              className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
            >
              <Link
                to={`/profiles/${relation.teacherId}`}
                className="text-sm text-indigo-600 hover:underline truncate"
              >
                {formatPersonName(relation.teacherName, TEACHER_GENERIC_LABEL)}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
