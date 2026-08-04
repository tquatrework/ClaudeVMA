import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCheckEmailAvailability } from '../hooks/accounts/useCheckEmailAvailability'
import { useParentRegistration } from '../hooks/accounts/useParentRegistration'

interface ParentFormData {
  firstName: string
  lastName: string
  email: string
  loginIdentifier: string
  password: string
  confirmPassword: string
}

const INITIAL_FORM_DATA: ParentFormData = {
  firstName: '',
  lastName: '',
  email: '',
  loginIdentifier: '',
  password: '',
  confirmPassword: '',
}

export default function ParentRegistrationPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<ParentFormData>(INITIAL_FORM_DATA)
  const [validationError, setValidationError] = useState<string | null>(null)
  const {
    alreadyUsed: isEmailAlreadyUsed,
    suggestedLoginIdentifier,
    error: checkEmailError,
    checkEmail,
  } = useCheckEmailAvailability()
  const { register, isSubmitting, error: submitError } = useParentRegistration()

  const errorMessage = validationError ?? submitError

  const handleFieldChange = (field: keyof ParentFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // Reflète l'identifiant proposé par le serveur dès qu'il est disponible.
  useEffect(() => {
    if (suggestedLoginIdentifier) {
      setFormData((prev) => ({ ...prev, loginIdentifier: suggestedLoginIdentifier }))
    }
  }, [suggestedLoginIdentifier])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setValidationError('Le prénom et le nom sont requis')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setValidationError('Les mots de passe ne correspondent pas')
      return
    }
    if (formData.password.length < 8) {
      setValidationError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    const success = await register({
      email: formData.email,
      loginIdentifier: formData.loginIdentifier || undefined,
      password: formData.password,
      firstName: formData.firstName,
      lastName: formData.lastName,
    })

    if (success) {
      navigate('/login', {
        state: {
          message: 'Compte Parent / Financeur créé. Veuillez vous connecter.',
        },
      })
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
              <input
                type="text"
                required
                value={formData.firstName}
                onChange={(e) => handleFieldChange('firstName', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Prénom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nom *</label>
              <input
                type="text"
                required
                value={formData.lastName}
                onChange={(e) => handleFieldChange('lastName', e.target.value)}
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
              value={formData.email}
              onChange={(e) => handleFieldChange('email', e.target.value)}
              onBlur={(e) => checkEmail(e.target.value)}
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
