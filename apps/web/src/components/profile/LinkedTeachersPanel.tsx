/**
 * LinkedTeachersPanel — liste des formateurs liés à un élève, visible pour
 * RP, AP, TI, AF et formateur.
 * Extrait de ProfilePage (lot 10 — normalisation, découpage > 300 lignes).
 *
 * Le RP y trouve, sur chaque formateur, de quoi mettre fin à la relation
 * (arbitrage du 2026-08-12, « Fin d'une relation élève↔formateur ») : c'est
 * la fiche de l'élève qui porte cette action, aucune autre page ne la propose.
 */

import React from 'react'
import { Link } from 'react-router-dom'
import type { TeacherStudentRelation } from '../../types/profile'
import { describeTeacherRelationName, TERMINATE_TEACHER_RELATION_ACTION_LABEL } from '../../utils/relationLabels'

interface LinkedTeachersPanelProps {
  teacherRelations: TeacherStudentRelation[]
  /** `true` uniquement pour le responsable pédagogique — seul rôle autorisé à mettre fin à la relation. */
  canTerminate?: boolean
  onRequestTermination?: (relation: TeacherStudentRelation) => void
}

export function LinkedTeachersPanel({
  teacherRelations,
  canTerminate = false,
  onRequestTermination,
}: LinkedTeachersPanelProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Formateurs liés</h2>
      {teacherRelations.length === 0 ? (
        <p className="text-gray-400 text-sm">Aucun formateur lié</p>
      ) : (
        <ul className="space-y-2">
          {teacherRelations.map((relation) => (
            <li
              key={relation.teacherId}
              className="flex items-center justify-between gap-3 py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Link
                  to={`/profiles/${relation.teacherId}`}
                  className="text-sm text-indigo-600 hover:underline truncate"
                >
                  {describeTeacherRelationName(relation)}
                </Link>
                {relation.isPrincipalTeacher && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full whitespace-nowrap">
                    Professeur principal
                  </span>
                )}
              </div>
              {canTerminate && onRequestTermination && (
                <button
                  type="button"
                  onClick={() => onRequestTermination(relation)}
                  className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline whitespace-nowrap"
                >
                  {/* Le nom est inclus dans le libellé du bouton (pas seulement
                      affiché à côté) : avec plusieurs formateurs liés, chaque
                      bouton doit rester identifiable individuellement — même
                      convention que « Délier Jean Martin » sur les liens de
                      financement, qui distingue aussi le bouton de ligne du
                      bouton de confirmation dans la boîte de dialogue. */}
                  {TERMINATE_TEACHER_RELATION_ACTION_LABEL} {describeTeacherRelationName(relation)}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
