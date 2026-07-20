import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCheckEmailAvailability } from '../hooks/accounts/useCheckEmailAvailability'
import { useStudentRegistration } from '../hooks/accounts/useStudentRegistration'

type WizardStep = 'administrative' | 'rgpd'

interface AdministrativeFormData {
  email: string
  loginIdentifier: string
  password: string
  passwordConfirm: string
  firstName: string
  lastName: string
  birthDate: string
  phoneNumber: string
}

interface RgpdFormData {
  hasAcceptedRgpd: boolean
  hasAcceptedCgu: boolean
}

const INITIAL_ADMINISTRATIVE: AdministrativeFormData = {
  email: '',
  loginIdentifier: '',
  password: '',
  passwordConfirm: '',
  firstName: '',
  lastName: '',
  birthDate: '',
  phoneNumber: '',
}

const INITIAL_RGPD: RgpdFormData = {
  hasAcceptedRgpd: false,
  hasAcceptedCgu: false,
}

export default function StudentRegistrationPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<WizardStep>('administrative')
  const [administrativeData, setAdministrativeData] = useState<AdministrativeFormData>(INITIAL_ADMINISTRATIVE)
  const [rgpdData, setRgpdData] = useState<RgpdFormData>(INITIAL_RGPD)
  const [validationError, setValidationError] = useState<string | null>(null)
  const {
    alreadyUsed: isEmailAlreadyUsed,
    suggestedLoginIdentifier,
    error: checkEmailError,
    checkEmail,
  } = useCheckEmailAvailability()
  const { register, isSubmitting, error: submitError } = useStudentRegistration()

  const errorMessage = validationError ?? submitError

  const handleAdministrativeChange = (field: keyof AdministrativeFormData, value: string) => {
    setAdministrativeData((prev) => ({ ...prev, [field]: value }))
  }

  // Reflète l'identifiant proposé par le serveur dès qu'il est disponible.
  useEffect(() => {
    if (suggestedLoginIdentifier) {
      setAdministrativeData((prev) => ({ ...prev, loginIdentifier: suggestedLoginIdentifier }))
    }
  }, [suggestedLoginIdentifier])

  const handleAdministrativeNext = (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (administrativeData.password !== administrativeData.passwordConfirm) {
      setValidationError('Les mots de passe ne correspondent pas')
      return
    }
    if (administrativeData.password.length < 8) {
      setValidationError('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    setCurrentStep('rgpd')
  }

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)

    if (!rgpdData.hasAcceptedRgpd || !rgpdData.hasAcceptedCgu) {
      setValidationError('Vous devez accepter les consentements RGPD et CGU pour créer votre compte')
      return
    }

    const success = await register({
      email: administrativeData.email,
      loginIdentifier: administrativeData.loginIdentifier || undefined,
      password: administrativeData.password,
      firstName: administrativeData.firstName,
      lastName: administrativeData.lastName,
      birthDate: administrativeData.birthDate || undefined,
      phoneNumber: administrativeData.phoneNumber || undefined,
      consents: {
        rgpd: rgpdData.hasAcceptedRgpd,
        cgu: rgpdData.hasAcceptedCgu,
      },
    })

    if (success) {
      navigate('/login', {
        state: {
          message:
            'Compte élève créé. Veuillez vous connecter puis finaliser vos consentements.',
        },
      })
    }
  }

  const stepLabels: Record<WizardStep, string> = {
    administrative: 'Informations administratives',
    rgpd: 'Consentements RGPD / CGU',
  }

  const stepOrder: WizardStep[] = ['administrative', 'rgpd']
  const currentStepIndex = stepOrder.indexOf(currentStep)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-indigo-600 mb-2">Créer un compte élève</h1>

        {/* Progress indicator */}
        <div className="flex items-center gap-2 mb-6">
          {stepOrder.map((stepId, index) => (
            <React.Fragment key={stepId}>
              <div
                className={`flex items-center gap-1.5 text-xs font-medium ${
                  index <= currentStepIndex ? 'text-indigo-600' : 'text-gray-400'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${
                    index < currentStepIndex
                      ? 'bg-indigo-600 text-white'
                      : index === currentStepIndex
                      ? 'border-2 border-indigo-600 text-indigo-600'
                      : 'border-2 border-gray-300 text-gray-400'
                  }`}
                >
                  {index < currentStepIndex ? '✓' : index + 1}
                </span>
                <span className="hidden sm:inline">{stepLabels[stepId]}</span>
              </div>
              {index < stepOrder.length - 1 && (
                <div
                  className={`flex-1 h-0.5 ${
                    index < currentStepIndex ? 'bg-indigo-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Step 1 — Administrative */}
        {currentStep === 'administrative' && (
          <form onSubmit={handleAdministrativeNext} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Informations administratives</h2>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Prénom *</label>
                <input
                  type="text"
                  required
                  value={administrativeData.firstName}
                  onChange={(e) => handleAdministrativeChange('firstName', e.target.value)}
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
                  onChange={(e) => handleAdministrativeChange('lastName', e.target.value)}
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
                onChange={(e) => handleAdministrativeChange('email', e.target.value)}
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
                {administrativeData.loginIdentifier && (
                  <span className="block mt-1 font-medium">
                    Identifiant proposé : {administrativeData.loginIdentifier}
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
                value={administrativeData.loginIdentifier}
                onChange={(e) => handleAdministrativeChange('loginIdentifier', e.target.value)}
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
                onChange={(e) => handleAdministrativeChange('password', e.target.value)}
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
                onChange={(e) => handleAdministrativeChange('passwordConfirm', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Répétez le mot de passe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de naissance
              </label>
              <input
                type="date"
                value={administrativeData.birthDate}
                onChange={(e) => handleAdministrativeChange('birthDate', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone
              </label>
              <input
                type="tel"
                value={administrativeData.phoneNumber}
                onChange={(e) => handleAdministrativeChange('phoneNumber', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="06 00 00 00 00"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 transition-colors"
            >
              Suivant
            </button>
          </form>
        )}

        {/* Step 2 — RGPD consents */}
        {currentStep === 'rgpd' && (
          <form onSubmit={handleFinalSubmit} className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-800">Consentements RGPD / CGU</h2>
            <p className="text-sm text-gray-500">
              Pour créer votre compte, vous devez accepter les conditions obligatoires ci-dessous.
            </p>

            <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                required
                checked={rgpdData.hasAcceptedRgpd}
                onChange={(e) =>
                  setRgpdData((prev) => ({ ...prev, hasAcceptedRgpd: e.target.checked }))
                }
                className="mt-0.5 rounded"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Protection des données personnelles (RGPD) *
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  J'accepte que mes données personnelles soient traitées conformément au RGPD.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                required
                checked={rgpdData.hasAcceptedCgu}
                onChange={(e) =>
                  setRgpdData((prev) => ({ ...prev, hasAcceptedCgu: e.target.checked }))
                }
                className="mt-0.5 rounded"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">
                  Conditions générales d'utilisation (CGU) *
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  J'accepte les conditions générales d'utilisation de la plateforme VisioMath.
                </p>
              </div>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setCurrentStep('administrative')}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {isSubmitting ? 'Création…' : 'Créer mon compte'}
              </button>
            </div>
          </form>
        )}

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
