/**
 * LinkedTeachersPanel — liste des formateurs liés à un élève, visible pour
 * RP, AP, TI, AF et formateur.
 * Extrait de ProfilePage (lot 10 — normalisation, découpage > 300 lignes).
 */

import React from 'react'
import { Link } from 'react-router-dom'

interface TeacherRelation {
  teacherId: string
  isPrincipalTeacher?: boolean
}

interface LinkedTeachersPanelProps {
  teacherRelations: TeacherRelation[]
}

export function LinkedTeachersPanel({ teacherRelations }: LinkedTeachersPanelProps) {
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
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <Link
                to={`/profiles/${relation.teacherId}`}
                className="text-sm text-indigo-600 hover:underline font-mono"
              >
                {relation.teacherId.slice(0, 12)}…
              </Link>
              {relation.isPrincipalTeacher && (
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  Professeur principal
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
