/**
 * PersonScopeSelector — « Personne consultée », barre de contexte de /archives.
 *
 * Forme retenue : une **barre de contexte sous le titre**, avec une liste déroulante
 * et, dès qu'on quitte son propre espace, la nature de l'accès et un retour explicite.
 * C'est la généralisation du sélecteur d'élève que la page proposait déjà au parent
 * financeur — donc rien de neuf à apprendre —, et la déclinaison locale du
 * « contexte actif » décrit par `.claude/design/front-design.md` : nom du contexte,
 * type d'accès, bouton de retour, sans créer de contexte global imbriqué.
 *
 * Deux règles de projet s'y appliquent :
 * - prénom + nom, jamais un UUID (arbitrage du 2026-08-09) ;
 * - on ne propose pas une action vouée au refus : les onglets d'archives sont retirés
 *   pour les personnes dont le lien n'ouvre que les statistiques. Le serveur reste
 *   seul juge de ce qui est autorisé ; le front choisit seulement ce qu'il montre.
 */

import React from 'react'
import type { ContactOption } from '../../hooks/relations/useMyContacts'
import { describeRelations } from '../../utils/relationAccess'

interface PersonScopeSelectorProps {
  selfDisplayName: string
  contacts: ContactOption[]
  selectedUserId: string
  selfUserId: string
  onSelectPerson: (userId: string) => void
  isLoadingContacts: boolean
  contactsError: string | null
}

const SELECT_ID = 'consultedPersonSelector'

export default function PersonScopeSelector({
  selfDisplayName,
  contacts,
  selectedUserId,
  selfUserId,
  onSelectPerson,
  isLoadingContacts,
  contactsError,
}: PersonScopeSelectorProps) {
  const isViewingOwnData = selectedUserId === selfUserId
  const selectedContact = contacts.find((contact) => contact.userId === selectedUserId)
  const accessLabels = selectedContact ? describeRelations(selectedContact.relations) : []

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <label htmlFor={SELECT_ID} className="text-sm font-medium text-gray-700 shrink-0">
          Personne consultée
        </label>

        <select
          id={SELECT_ID}
          value={selectedUserId}
          onChange={(changeEvent) => onSelectPerson(changeEvent.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 flex-1 min-w-[16rem] max-w-sm"
        >
          <option value={selfUserId}>{`Moi — ${selfDisplayName}`}</option>
          {contacts.map((contact) => (
            <option key={contact.userId} value={contact.userId}>
              {`${contact.displayName} — ${describeRelations(contact.relations).join(', ')}`}
            </option>
          ))}
        </select>

        {!isViewingOwnData && (
          <button
            type="button"
            onClick={() => onSelectPerson(selfUserId)}
            className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Revenir à mes données
          </button>
        )}
      </div>

      {isLoadingContacts && (
        <p className="text-sm text-gray-400">Chargement de vos contacts…</p>
      )}

      {contactsError && (
        <p className="text-sm text-amber-700">
          {contactsError} Vous pouvez consulter vos propres données en attendant.
        </p>
      )}

      {!isLoadingContacts && !contactsError && contacts.length === 0 && (
        <p className="text-sm text-gray-400">
          Aucune personne reliée à votre compte pour le moment : seules vos propres données
          sont consultables ici.
        </p>
      )}

      {!isViewingOwnData && (
        <p className="text-sm text-gray-500">
          Vous consultez les données de{' '}
          <span className="font-medium text-gray-800">{selectedContact?.displayName}</span>
          {accessLabels.length > 0 && (
            <>
              {' '}
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5">
                {accessLabels.join(', ')}
              </span>
            </>
          )}
          .
        </p>
      )}
    </div>
  )
}
