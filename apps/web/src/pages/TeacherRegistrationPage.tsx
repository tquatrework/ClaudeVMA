import React, { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useCheckEmailAvailability } from '../hooks/accounts/useCheckEmailAvailability'
import { useTeacherRegistration } from '../hooks/accounts/useTeacherRegistration'
import { RegistrationProgressIndicator } from '../components/accounts/RegistrationProgressIndicator'
import {
  TeacherAdministrativeStep,
  type TeacherAdministrativeFormData,
} from '../components/accounts/TeacherAdministrativeStep'
import { RegistrationRgpdStep } from '../components/accounts/RegistrationRgpdStep'
import {
  buildRegistrationConsents,
  hasGivenRequiredConsents,
} from '../utils/registrationConsents'
import type { RegistrationConsentsFormData } from '../types/accounts'

type WizardStep = 'administrative' | 'rgpd'

const INITIAL_ADMINISTRATIVE: TeacherAdministrativeFormData = {
  email: '',
  loginIdentifier: '',
  password: '',
  passwordConfirm: '',
  firstName: '',
  lastName: '',
  phoneNumber: '',
}

const INITIAL_RGPD: RegistrationConsentsFormData = {
  hasAcceptedRgpd: false,
  hasAcceptedCgu: false,
}

const STEP_ORDER: WizardStep[] = ['administrative', 'rgpd']

const STEP_LABELS: Record<WizardStep, string> = {
  administrative: 'Informations administratives',
  rgpd: 'Consentements',
}

export default function TeacherRegistrationPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<WizardStep>('administrative')
  const [administrativeData, setAdministrativeData] = useState<TeacherAdministrativeFormData>(INITIAL_ADMINISTRATIVE)
  const [rgpdData, setRgpdData] = useState<RegistrationConsentsFormData>(INITIAL_RGPD)
  const [validationError, setValidationError] = useState<string | null>(null)
  const {
    alreadyUsed: isEmailAlreadyUsed,
    suggestedLoginIdentifier,
    error: checkEmailError,
    checkEmail,
  } = useCheckEmailAvailability()
  const { register, isSubmitting, error: submitError } = useTeacherRegistration()

  const errorMessage = validationError ?? submitError

  const handleAdministrativeChange = (field: keyof TeacherAdministrativeFormData, value: string) => {
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

    if (!hasGivenRequiredConsents(rgpdData)) {
      setValidationError('Vous devez accepter les consentements RGPD et CGU pour créer votre compte')
      return
    }

    const success = await register({
      email: administrativeData.email,
      loginIdentifier: administrativeData.loginIdentifier || undefined,
      password: administrativeData.password,
      firstName: administrativeData.firstName,
      lastName: administrativeData.lastName,
      phoneNumber: administrativeData.phoneNumber || undefined,
      consents: buildRegistrationConsents(rgpdData),
    })

    if (success) {
      navigate('/login', {
        state: {
          message:
            'Votre demande de compte formateur a été soumise, vos consentements sont enregistrés. Elle sera examinée par un Responsable Pédagogique. Vous compléterez votre profil pédagogique après connexion.',
        },
      })
    }
  }

  const currentStepIndex = STEP_ORDER.indexOf(currentStep)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-indigo-600 mb-2">Créer un compte formateur</h1>
        <p className="text-sm text-gray-500 mb-4">
          Votre dossier sera examiné par un Responsable Pédagogique avant activation. Vous
          renseignerez votre profil pédagogique (matières, niveaux, présentation) depuis votre
          espace, après connexion.
        </p>

        <RegistrationProgressIndicator
          steps={STEP_ORDER.map((stepId) => ({ id: stepId, label: STEP_LABELS[stepId] }))}
          currentStepIndex={currentStepIndex}
        />

        {errorMessage && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {errorMessage}
          </div>
        )}

        {currentStep === 'administrative' && (
          <TeacherAdministrativeStep
            administrativeData={administrativeData}
            onChange={handleAdministrativeChange}
            onEmailBlur={checkEmail}
            checkEmailError={checkEmailError}
            isEmailAlreadyUsed={isEmailAlreadyUsed}
            onSubmit={handleAdministrativeNext}
          />
        )}

        {currentStep === 'rgpd' && (
          <RegistrationRgpdStep
            rgpdData={rgpdData}
            onRgpdChange={(field, value) => setRgpdData((prev) => ({ ...prev, [field]: value }))}
            onBack={() => setCurrentStep('administrative')}
            onSubmit={handleFinalSubmit}
            isSubmitting={isSubmitting}
            submitLabel="Soumettre ma candidature"
            submittingLabel="Envoi…"
          />
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
