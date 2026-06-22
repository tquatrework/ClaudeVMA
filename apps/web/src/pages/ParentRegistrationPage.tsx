import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import apiClient from '../api/client'

interface ParentFormData {
  email: string
  loginIdentifier: string
  password: string
  confirmPassword: string
}

const INITIAL_FORM_DATA: ParentFormData = {
  email: '',
  loginIdentifier: '',
  password: '',
  confirmPassword: '',
}

export default function ParentRegistrationPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<ParentFormData>(INITIAL_FORM_DATA)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEmailAlreadyUsed, setIsEmailAlreadyUsed] = useState(false)

  const handleFieldChange = (field: keyof ParentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const checkEmailAvailability = async (emailValue: string) => {
    if (!emailValue) return
    try {
      const response = await apiClient.get<{ alreadyUsed: boolean; suggestedLoginIdentifier: string }>(
        `/accounts/check-email?email=${encodeURIComponent(emailValue)}`
      )
      setIsEmailAlreadyUsed(response.data.alreadyUsed)
      if (response.data.suggestedLoginIdentifier) {
        setFormData((prev) => ({
          ...prev,
          loginIdentifier: response.data.suggestedLoginIdentifier,
        }))
      }
    } catch {
      // silencieux
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)

    if (formData.password !== formData.confirmPassword) {
      setErrorMessage('Les mots de passe ne correspondent pas')
      return
    }
    if (formData.password.length < 8) {
      setErrorMessage('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    setIsSubmitting(true)
    try {
      await apiClient.post('/accounts/parents', {
        email: formData.email,
        loginIdentifier: formData.loginIdentifier || undefined,
        password: formData.password,
      })
      navigate('/login', {
        state: {
          message: 'Compte Parent / Financeur créé. Veuillez vous connecter.',
        },
      })
    } catch (err: unknown) {
      const apiMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Erreur lors de la création du compte'
      setErrorMessage(apiMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-indigo-600 mb-6">
          Créer un compte Parent / Financeur
        </h1>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Adresse e-mail *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              onBlur={(e) => checkEmailAvailability(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="vous@exemple.fr"
            />
          </div>

          {isEmailAlreadyUsed && (
            <div className="p-3 bg-yellow-50 border border-yellow-300 rounded-lg text-yellow-800 text-sm">
              Cet email est déjà utilisé pour un autre compte. Vous pouvez continuer avec le même email de contact.
              {formData.loginIdentifier && (
                <span className="block mt-1 font-medium">
                  Identifiant proposé : {formData.loginIdentifier}
                </span>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identifiant de connexion
            </label>
            <input
              type="text"
              value={formData.loginIdentifier}
              onChange={(e) => handleFieldChange('loginIdentifier', e.target.value)}
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
              value={formData.password}
              onChange={(e) => handleFieldChange('password', e.target.value)}
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
              value={formData.confirmPassword}
              onChange={(e) => handleFieldChange('confirmPassword', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Répétez le mot de passe"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500 text-center">
          Déjà inscrit ?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
