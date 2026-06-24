import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import apiClient from '../api/client'

type RequestStep = 'form' | 'sent'

export default function PasswordResetPage() {
  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [step, setStep] = useState<RequestStep>('form')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)
    try {
      await apiClient.post('/auth/password-reset/request', { loginIdentifier })
      setStep('sent')
    } catch (err: unknown) {
      const apiMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Erreur lors de la demande de réinitialisation'
      setErrorMessage(apiMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (step === 'sent') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8 text-center">
          <div className="mb-4 text-4xl">📧</div>
          <h1 className="text-2xl font-bold text-indigo-600 mb-3">E-mail envoyé</h1>
          <p className="text-gray-600 text-sm mb-6">
            Un lien de réinitialisation a été envoyé à l'adresse email associée à votre identifiant.
          </p>
          <Link
            to="/login"
            className="inline-block bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 text-sm font-medium transition-colors"
          >
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-indigo-600 mb-2">Mot de passe oublié</h1>
        <p className="text-sm text-gray-500 mb-6">
          Saisissez votre identifiant de connexion pour recevoir un lien de réinitialisation.
        </p>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identifiant de connexion
            </label>
            <input
              type="text"
              required
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="jean.dupont"
              autoComplete="username"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Envoi…' : 'Envoyer le lien de réinitialisation'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500 text-center">
          <Link to="/recover-identifier" className="text-indigo-600 hover:underline">
            Identifiant oublié ?
          </Link>
        </p>

        <p className="mt-2 text-sm text-gray-500 text-center">
          <Link to="/login" className="text-indigo-600 hover:underline">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  )
}
