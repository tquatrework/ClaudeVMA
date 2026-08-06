/**
 * InviteStudentForm — formulaire de déclaration d'un élève par le parent financeur.
 * Extrait de LinkedStudentsSection (lot 10 — normalisation, découpage > 300 lignes).
 * Entièrement autonome : l'invitation n'impacte pas les listes déjà chargées ailleurs
 * dans la page.
 */

import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { createParentLinkRequest } from '../../api/parentLinkRequest'

export function InviteStudentForm() {
  const [studentFirstNameInput, setStudentFirstNameInput] = useState('')
  const [studentLastNameInput, setStudentLastNameInput] = useState('')
  const [studentLoginIdentifierInput, setStudentLoginIdentifierInput] = useState('')
  const [isSubmittingInvitation, setIsSubmittingInvitation] = useState(false)
  const [invitationSuccessMessage, setInvitationSuccessMessage] = useState<string | null>(null)
  const [invitationError, setInvitationError] = useState<string | null>(null)

  const handleSendInvitation = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmedIdentifier = studentLoginIdentifierInput.trim()
    if (!trimmedIdentifier) return

    setIsSubmittingInvitation(true)
    setInvitationError(null)
    setInvitationSuccessMessage(null)

    try {
      await createParentLinkRequest(trimmedIdentifier)
      setInvitationSuccessMessage(
        "Invitation envoyée. L'élève recevra une notification pour accepter.",
      )
      setStudentFirstNameInput('')
      setStudentLastNameInput('')
      setStudentLoginIdentifierInput('')
    } catch (err: unknown) {
      const axiosError = err as { response?: { status?: number; data?: { message?: string } } }
      if (axiosError.response?.status === 409) {
        setInvitationError('Une demande est déjà en cours pour cet élève.')
      } else if (axiosError.response?.status === 404) {
        setInvitationError("Identifiant élève introuvable. Vérifiez l'identifiant communiqué.")
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
      <h3 className="text-base font-semibold text-gray-800 mb-1">Déclarer un élève</h3>
      <p className="text-xs text-gray-500 mb-4">
        Envoyez une demande de rattachement à un élève. Celui-ci devra l'approuver.
      </p>

      <form onSubmit={handleSendInvitation} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="studentFirstName" className="block text-xs font-medium text-gray-600 mb-1">
              Prénom (indicatif)
            </label>
            <input
              id="studentFirstName"
              type="text"
              value={studentFirstNameInput}
              onChange={(e) => setStudentFirstNameInput(e.target.value)}
              placeholder="ex : Lucas"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              disabled={isSubmittingInvitation}
            />
          </div>
          <div>
            <label htmlFor="studentLastName" className="block text-xs font-medium text-gray-600 mb-1">
              Nom (indicatif)
            </label>
            <input
              id="studentLastName"
              type="text"
              value={studentLastNameInput}
              onChange={(e) => setStudentLastNameInput(e.target.value)}
              placeholder="ex : Martin"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              disabled={isSubmittingInvitation}
            />
          </div>
        </div>

        <div>
          <label htmlFor="studentLoginIdentifier" className="block text-xs font-medium text-gray-600 mb-1">
            Identifiant de l'élève <span className="text-red-500">*</span>
          </label>
          <input
            id="studentLoginIdentifier"
            type="text"
            required
            value={studentLoginIdentifierInput}
            onChange={(e) => setStudentLoginIdentifierInput(e.target.value)}
            placeholder="ex : lucas.martin"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            disabled={isSubmittingInvitation}
          />
          <p className="text-xs text-gray-400 mt-1">
            Identifiant de connexion communiqué par l'élève ou l'établissement.
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
            disabled={isSubmittingInvitation || !studentLoginIdentifierInput.trim()}
            className="bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmittingInvitation ? 'Envoi…' : 'Envoyer une invitation'}
          </button>

          <Link
            to="/register/student"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-indigo-300 text-indigo-700 text-sm px-5 py-2 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            Créer un compte élève
          </Link>
        </div>
      </form>
    </div>
  )
}
