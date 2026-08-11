/**
 * AccountEmailField — adresse e-mail du compte, affichée dans le bloc
 * administratif mais **en lecture seule**.
 *
 * L'e-mail n'appartient pas à `profile-service` : c'est une donnée du **compte**,
 * portée par `identity-access-service` (arbitrage du 2026-08-08, où `email` et
 * `loginIdentifier` ont été reconnus comme deux données distinctes). Le front la
 * lit donc dans la session authentifiée (`POST /auth/login`, `GET /auth/me`), et
 * ne l'envoie à aucune route de profil — vérifié le 2026-08-11 contre la pile
 * réelle : `PUT /profiles/:userId/administrative` avec `{email}` répond
 * `400 {"message":["property email should not exist"]}`.
 *
 * **Pourquoi pas un champ de saisie.** Aucune route ne permet aujourd'hui de
 * changer l'e-mail d'un compte : `PUT /accounts/:accountId` répond
 * `404 Cannot PUT /accounts/...` (vérifié le 2026-08-11). Un champ modifiable
 * accepterait donc une saisie pour la jeter — exactement le défaut que ce projet
 * corrige depuis plusieurs jours (consentements avalés par le `ValidationPipe`,
 * `loginIdentifier` ignoré sur `/accounts/parents`). On affiche l'adresse, on dit
 * clairement qu'elle ne se modifie pas ici, et on n'ouvre pas de fausse porte.
 *
 * **Uniquement sur son propre profil.** L'adresse d'autrui est une donnée de
 * contact sensible, hors du catalogue de visibilité de `profile-service` : aucun
 * réglage ne permet au titulaire de la masquer. Faute de pouvoir la protéger, on
 * ne l'expose pas — l'appelant ne passe `email` que lorsque le lecteur est le
 * titulaire.
 */

import React from 'react'
import { getProfileFieldHint, getProfileFieldLabel } from '../../utils/profileFieldLabels'

const EMAIL_FIELD_NAME = 'email'

interface AccountEmailFieldProps {
  /**
   * Adresse du compte, telle que la session authentifiée la renvoie. `null` ou
   * absente, rien n'est affiché : mieux vaut pas de ligne qu'une ligne vide sur
   * une donnée que l'utilisateur ne peut de toute façon pas renseigner ici.
   */
  email?: string | null
}

export function AccountEmailField({ email }: AccountEmailFieldProps) {
  if (!email) return null

  const hint = getProfileFieldHint(EMAIL_FIELD_NAME)

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <dl>
        <dt className="text-sm font-medium text-gray-500">
          {getProfileFieldLabel(EMAIL_FIELD_NAME)}
        </dt>
        <dd className="text-sm text-gray-800 mt-1 break-words">{email}</dd>
      </dl>
      {hint && <p className="text-xs text-gray-400 mt-2">{hint}</p>}
    </div>
  )
}
