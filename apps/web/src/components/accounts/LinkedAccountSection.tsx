/**
 * LinkedAccountSection — bloc optionnel des pages d'inscription permettant de
 * lier directement le compte en cours de création à un parent financeur
 * (inscription élève) ou à un élève (inscription parent), via les champs
 * optionnels de `POST /accounts/students` / `POST /accounts/parents`.
 *
 * Deux affichages :
 * - `lockedLoginIdentifier` fourni (ex. arrivée depuis le profil d'un compte
 *   existant via `?parentLoginIdentifier=...`/`?studentLoginIdentifier=...`) :
 *   bloc en lecture seule, la liaison est automatique, aucun choix proposé.
 * - Sinon : trois choix (ne rien lier / lier un compte existant / créer un
 *   nouveau compte lié).
 *
 * Le champ « Identifiant de connexion » est présent dans les deux modes de
 * saisie, car il porte la même donnée (`parentLoginIdentifier` /
 * `studentLoginIdentifier`) : il désigne le compte à rattacher en mode
 * `existing`, et nomme le compte créé en mode `new` — un compte créé en
 * parallèle doit pouvoir se connecter, son identifiant est donc choisi, jamais
 * dérivé de son email (docs/architecture.md, arbitrage du 2026-08-09).
 */

import React from 'react'
import {
  LINKED_ACCOUNT_LABELS,
  type LinkedAccountFormData,
  type LinkedAccountMode,
  type LinkedAccountRelation,
} from '../../utils/accountLinking'

interface LinkedAccountSectionProps {
  relation: LinkedAccountRelation
  data: LinkedAccountFormData
  onChange: (data: LinkedAccountFormData) => void
  lockedLoginIdentifier?: string | null
}

const PLACEHOLDERS: Record<
  LinkedAccountRelation,
  { identifier: string; firstName: string; lastName: string }
> = {
  parent: { identifier: 'ex : marie.dupont', firstName: 'ex : Marie', lastName: 'ex : Dupont' },
  student: { identifier: 'ex : lucas.martin', firstName: 'ex : Lucas', lastName: 'ex : Martin' },
}

export function LinkedAccountSection({
  relation,
  data,
  onChange,
  lockedLoginIdentifier,
}: LinkedAccountSectionProps) {
  const { target } = LINKED_ACCOUNT_LABELS[relation]
  const fieldPrefix = `linked-account-${relation}`
  const placeholders = PLACEHOLDERS[relation]

  if (lockedLoginIdentifier) {
    return (
      <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4">
        <p className="text-sm font-medium text-indigo-900">
          Compte {target} lié automatiquement
        </p>
        <p className="text-xs text-indigo-700 mt-1">
          Ce compte sera lié au compte {target} en cours (identifiant :{' '}
          <span className="font-semibold">{lockedLoginIdentifier}</span>).
        </p>
      </div>
    )
  }

  const setMode = (mode: LinkedAccountMode) => onChange({ ...data, mode })

  return (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <p className="text-sm font-medium text-gray-700">Lier un compte {target} (optionnel)</p>

      <div className="flex flex-wrap gap-4 text-sm text-gray-700">
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={fieldPrefix}
            checked={data.mode === 'none'}
            onChange={() => setMode('none')}
          />
          Ne rien lier maintenant
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={fieldPrefix}
            checked={data.mode === 'existing'}
            onChange={() => setMode('existing')}
          />
          Lier un compte {target} existant
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="radio"
            name={fieldPrefix}
            checked={data.mode === 'new'}
            onChange={() => setMode('new')}
          />
          Créer un nouveau compte {target} lié
        </label>
      </div>

      {data.mode === 'existing' && (
        <div>
          <label
            htmlFor={`${fieldPrefix}-loginIdentifier`}
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Identifiant {target}
          </label>
          <input
            id={`${fieldPrefix}-loginIdentifier`}
            type="text"
            value={data.loginIdentifier}
            onChange={(e) => onChange({ ...data, loginIdentifier: e.target.value })}
            placeholder={placeholders.identifier}
            autoComplete="off"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          <p className="text-xs text-gray-500 mt-1">
            Identifiant avec lequel ce compte se connecte déjà.
          </p>
        </div>
      )}

      {data.mode === 'new' && (
        <div className="space-y-3">
          <p className="text-xs text-gray-500">
            Ce compte {target} sera créé en même temps que le vôtre et pourra se connecter avec
            l'identifiant choisi ci-dessous.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor={`${fieldPrefix}-firstName`}
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Prénom {target}
              </label>
              <input
                id={`${fieldPrefix}-firstName`}
                type="text"
                value={data.firstName}
                onChange={(e) => onChange({ ...data, firstName: e.target.value })}
                placeholder={placeholders.firstName}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label
                htmlFor={`${fieldPrefix}-lastName`}
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Nom {target}
              </label>
              <input
                id={`${fieldPrefix}-lastName`}
                type="text"
                value={data.lastName}
                onChange={(e) => onChange({ ...data, lastName: e.target.value })}
                placeholder={placeholders.lastName}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor={`${fieldPrefix}-email`}
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Email {target}
            </label>
            <input
              id={`${fieldPrefix}-email`}
              type="email"
              value={data.email}
              onChange={(e) => onChange({ ...data, email: e.target.value })}
              placeholder="ex : contact@exemple.fr"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>

          <div>
            <label
              htmlFor={`${fieldPrefix}-newLoginIdentifier`}
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Identifiant de connexion {target}
            </label>
            <input
              id={`${fieldPrefix}-newLoginIdentifier`}
              type="text"
              value={data.loginIdentifier}
              onChange={(e) => onChange({ ...data, loginIdentifier: e.target.value })}
              placeholder={placeholders.identifier}
              autoComplete="off"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
            <p className="text-xs text-gray-500 mt-1">
              Cet identifiant lui servira à se connecter.
            </p>
          </div>

          <div>
            <label
              htmlFor={`${fieldPrefix}-password`}
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Mot de passe {target} (optionnel)
            </label>
            <input
              id={`${fieldPrefix}-password`}
              type="password"
              value={data.password}
              onChange={(e) => onChange({ ...data, password: e.target.value })}
              placeholder="Laisser vide pour réutiliser le même mot de passe"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            />
          </div>
        </div>
      )}
    </div>
  )
}
