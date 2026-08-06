/**
 * InviteParentForm — formulaire d'invitation d'un parent financeur par l'élève.
 * Extrait de ParentFinanceurSection (lot 10 — normalisation, découpage > 300 lignes).
 * Entièrement autonome : aucune donnée du parent (élève) n'est nécessaire, l'invitation
 * n'impacte pas les listes déjà chargées ailleurs dans la page.
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { createStudentInitiatedRequest } from '../../api/parentLinkRequest'

export function InviteParentForm() {
  const [parentFirstNameInput, setParentFirstNameInput] = useState('')
  const [parentLastNameInput, setParentLastNameInput] = useState('')
  const [parentLoginIdentifierInput, setParentLoginIdentifierInput] = useState('')
  const [isSubmittingInvitation, setIsSubmittingInvitation] = useState(false)
  const [invitationSuccessMessage, setInvitationSuccessMessage] = useState<string | null>(null)
  const [invitationError, setInvitationError] = useState<string | null>(null)

  const handleSendInvitation = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedIdentifier = parentLoginIdentifierInput.trim()
    if (!trimmedIdentifier) return

    setIsSubmittingInvitation(true)
    setInvitationError(null)
    setInvitationSuccessMessage(null)

    try {
      await createStudentInitiatedRequest(trimmedIdentifier)
      setInvitationSuccessMessage(
        'Invitation envoyée. Votre parent financeur recevra une notification pour accepter.',
      )
      setParentFirstNameInput('')
      setParentLastNameInput('')
      setParentLoginIdentifierInput('')
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } }
      if (axiosError.response?.status === 409) {
        setInvitationError('Une demande est déjà en cours pour ce parent.')
      } else if (axiosError.response?.status === 404) {
        setInvitationError('Identifiant parent introuvable. Vérifiez l\'identifiant communiqué.')
      } else {
        setInvitationError(
          axiosError.response?.data?.message ?? 'Une erreur est survenue. Veuillez réessayer.',
        )
      }
    } finally {
      setIsSubmittingInvitation(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="text-base font-semibold text-gray-800 mb-1">Déclarer un parent financeur</h3>
      <p className="text-xs text-gray-500 mb-4">
        Invitez votre parent financeur à se rattacher à votre compte.
      </p>

      <form onSubmit={handleSendInvitation} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="parentFirstName" className="block text-xs font-medium text-gray-600 mb-1">
              Prénom (indicatif)
            </label>
            <input
              id="parentFirstName"
              type="text"
              value={parentFirstNameInput}
              onChange={(e) => setParentFirstNameInput(e.target.value)}
              placeholder="ex : Marie"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              disabled={isSubmittingInvitation}
            />
          </div>
          <div>
            <label htmlFor="parentLastName" className="block text-xs font-medium text-gray-600 mb-1">
              Nom (indicatif)
            </label>
            <input
              id="parentLastName"
              type="text"
              value={parentLastNameInput}
              onChange={(e) => setParentLastNameInput(e.target.value)}
              placeholder="ex : Dupont"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              disabled={isSubmittingInvitation}
            />
          </div>
        </div>

        <div>
          <label htmlFor="parentLoginIdentifier" className="block text-xs font-medium text-gray-600 mb-1">
            Identifiant du parent <span className="text-red-500">*</span>
          </label>
          <input
            id="parentLoginIdentifier"
            type="text"
            required
            value={parentLoginIdentifierInput}
            onChange={(e) => setParentLoginIdentifierInput(e.target.value)}
            placeholder="ex : marie.dupont"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            disabled={isSubmittingInvitation}
          />
          <p className="text-xs text-gray-400 mt-1">
            Identifiant de connexion communiqué par votre parent.
          </p>
        </div>

        {invitationError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {invitationError}
          </div>
        )}

        {invitationSuccessMessage && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {invitationSuccessMessage}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isSubmittingInvitation || !parentLoginIdentifierInput.trim()}
            className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmittingInvitation ? 'Envoi…' : 'Envoyer une invitation'}
          </button>

          <Link
            to="/register/parent"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-indigo-300 text-indigo-700 text-sm px-5 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Créer un nouveau compte parent
          </Link>
        </div>
      </form>
    </div>
  )
}
