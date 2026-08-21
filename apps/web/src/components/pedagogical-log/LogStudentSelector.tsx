/**
 * LogStudentSelector — « Élève consulté », barre de contexte de `/pedagogical-log`
 * pour les rôles qui suivent plusieurs élèves (formateur, parent financeur, RP,
 * animateur pédagogique).
 *
 * Pattern imposé pour le parent financeur (règles de projet, section « Vue
 * parent_financeur ») : sélecteur d'élève en haut de page, sans option
 * « Tous » — le cahier de texte se lit un élève à la fois
 * (`GET /students/:studentId/pedagogical-log`), pas de vue agrégée possible.
 * Par défaut, le premier élève lié est sélectionné (géré par l'appelant).
 */

import React from 'react'
import type { ContactOption } from '../../hooks/relations/useMyContacts'
import { describeRelations } from '../../utils/relationAccess'

interface LogStudentSelectorProps {
  studentContacts: ContactOption[]
  selectedStudentId: string
  onSelectStudent: (studentId: string) => void
  isLoadingContacts: boolean
  contactsError: string | null
}

const SELECT_ID = 'logStudentSelector'

export default function LogStudentSelector({
  studentContacts,
  selectedStudentId,
  onSelectStudent,
  isLoadingContacts,
  contactsError,
}: LogStudentSelectorProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={SELECT_ID} className="text-sm font-medium text-gray-700 shrink-0">
          Élève consulté
        </label>

        {studentContacts.length > 0 ? (
          <select
            id={SELECT_ID}
            value={selectedStudentId}
            onChange={(changeEvent) => onSelectStudent(changeEvent.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 flex-1 min-w-[16rem] max-w-sm"
          >
            {studentContacts.map((contact) => (
              <option key={contact.userId} value={contact.userId}>
                {`${contact.displayName} — ${describeRelations(contact.relations).join(', ')}`}
              </option>
            ))}
          </select>
        ) : (
          !isLoadingContacts && (
            <p className="text-sm text-gray-400">
              Aucun élève rattaché à votre compte pour le moment.
            </p>
          )
        )}
      </div>

      {isLoadingContacts && <p className="text-sm text-gray-400">Chargement de vos élèves…</p>}

      {contactsError && <p className="text-sm text-amber-700">{contactsError}</p>}
    </div>
  )
}
