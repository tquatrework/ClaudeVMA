/**
 * StudentAdministrativeStep — étape 1 (informations administratives) du wizard
 * d'inscription élève.
 * Extrait de StudentRegistrationPage (lot 10 — normalisation, découpage > 300 lignes).
 *
 * Le champ « Date de naissance » a été retiré le 2026-08-09 : il n'était stocké nulle
 * part (`POST /accounts/students` ne déclare pas `birthDate` et le refuse désormais
 * en `400`, profile-service ne sait pas encore le recevoir). Il sera remis quand
 * profile-service saura le stocker — voir le rapport front du 2026-08-09.
 */

import React from 'react'

export interface StudentAdministrativeFormData {
  email: string
  loginIdentifier: string
  password: string
  passwordConfirm: string
  firstName: string
  lastName: string
  phoneNumber: string
}

interface StudentAdministrativeStepProps {
  administrativeData: StudentAdministrativeFormData
  onChange: (field: keyof StudentAdministrativeFormData, value: string) => void
  onEmailBlur: (email: string) => void
  checkEmailError: string | null
  isEmailAlreadyUsed: boolean
  onSubmit: (event: React.FormEvent) => void
  /** Contenu additionnel inséré avant le bouton de soumission (ex. LinkedAccountSection). */
  children?: React.ReactNode
}

export function StudentAdministrativeStep({
  administrativeData,
  onChange,
  onEmailBlur,
  checkEmailError,
  isEmailAlreadyUsed,
  onSubmit,
  children,
}: StudentAdministrativeStepProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-800">Informations administratives</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
          <input
            type="text"
            required
            value={administrativeData.firstName}
            onChange={(e) => onChange('firstName', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Prénom"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
          <input
            type="text"
            required
            value={administrativeData.lastName}
            onChange={(e) => onChange('lastName', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="Nom de famille"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Adresse e-mail *
        </label>
        <input
          type="email"
          required
          value={administrativeData.email}
          onChange={(e) => onChange('email', e.target.value)}
          onBlur={(e) => onEmailBlur(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="vous@exemple.fr"
        />
      </div>

      {checkEmailError && (
        <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          {checkEmailError}
        </div>
      )}

      {isEmailAlreadyUsed && (
        <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
          Cet email est déjà utilisé pour un autre compte. Vous pouvez continuer avec le même email de contact.
          {administrativeData.loginIdentifier && (
            <span className="block mt-1 font-medium">
              Identifiant proposé : {administrativeData.loginIdentifier}
            </span>
          )}
        </div>
      )}

      <div>
        <label
          htmlFor="student-loginIdentifier"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Identifiant de connexion
        </label>
        <input
          id="student-loginIdentifier"
          type="text"
          value={administrativeData.loginIdentifier}
          onChange={(e) => onChange('loginIdentifier', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="jean.dupont"
          autoComplete="username"
        />
        <p className="text-xs text-gray-500 mt-1">
          Cet identifiant vous servira à vous connecter.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Mot de passe *
        </label>
        <input
          type="password"
          required
          minLength={8}
          value={administrativeData.password}
          onChange={(e) => onChange('password', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="8 caractères minimum"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Confirmer le mot de passe *
        </label>
        <input
          type="password"
          required
          value={administrativeData.passwordConfirm}
          onChange={(e) => onChange('passwordConfirm', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Répétez le mot de passe"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Téléphone
        </label>
        <input
          type="tel"
          value={administrativeData.phoneNumber}
          onChange={(e) => onChange('phoneNumber', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="06 00 00 00 00"
        />
      </div>

      <p className="text-xs text-gray-500">
        Vos autres informations (date de naissance, adresse…) se renseignent depuis votre profil,
        après connexion.
      </p>

      {children}

      <button
        type="submit"
        className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
      >
        Suivant
      </button>
    </form>
  )
}
