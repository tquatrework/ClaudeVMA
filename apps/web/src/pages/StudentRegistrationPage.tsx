import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useCheckEmailAvailability } from '../hooks/accounts/useCheckEmailAvailability'
import { useStudentRegistration } from '../hooks/accounts/useStudentRegistration'
import { RegistrationProgressIndicator } from '../components/accounts/RegistrationProgressIndicator'
import {
  StudentAdministrativeStep,
  type StudentAdministrativeFormData,
} from '../components/accounts/StudentAdministrativeStep'
import { RegistrationRgpdStep } from '../components/accounts/RegistrationRgpdStep'
import { LinkedAccountSection } from '../components/accounts/LinkedAccountSection'
import {
  INITIAL_LINKED_ACCOUNT_DATA,
  buildLinkedAccountFields,
  validateLinkedAccountData,
  type LinkedAccountFormData,
} from '../utils/accountLinking'

type WizardStep = 'administrative' | 'rgpd'

interface RgpdFormData {
  hasAcceptedRgpd: boolean
  hasAcceptedCgu: boolean
}

const INITIAL_ADMINISTRATIVE: StudentAdministrativeFormData = {
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

const STEP_ORDER: WizardStep[] = ['administrative', 'rgpd']

const STEP_LABELS: Record<WizardStep, string> = {
  administrative: 'Informations administratives',
  rgpd: 'Consentements RGPD / CGU',
}

export default function StudentRegistrationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Arrivée depuis le profil d'un parent existant (bouton "Créer un compte élève") :
  // le parent est déjà identifié, la liaison est automatique (voir docs/routes.md).
  const lockedParentLoginIdentifier = searchParams.get('parentLoginIdentifier')
  const [currentStep, setCurrentStep] = useState<WizardStep>('administrative')
  const [administrativeData, setAdministrativeData] = useState<StudentAdministrativeFormData>(INITIAL_ADMINISTRATIVE)
  const [rgpdData, setRgpdData] = useState<RgpdFormData>(INITIAL_RGPD)
  const [linkedParentData, setLinkedParentData] = useState<LinkedAccountFormData>(INITIAL_LINKED_ACCOUNT_DATA)
  const [validationError, setValidationError] = useState<string | null>(null)
  const {
    alreadyUsed: isEmailAlreadyUsed,
    suggestedLoginIdentifier,
    error: checkEmailError,
    checkEmail,
  } = useCheckEmailAvailability()
  const { register, isSubmitting, error: submitError } = useStudentRegistration()

  const errorMessage = validationError ?? submitError

  const handleAdministrativeChange = (field: keyof StudentAdministrativeFormData, value: string) => {
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

    const linkedAccountError = validateLinkedAccountData(
      'parent',
      linkedParentData,
      lockedParentLoginIdentifier,
    )
    if (linkedAccountError) {
      setValidationError(linkedAccountError)
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
      ...buildLinkedAccountFields('parent', linkedParentData, lockedParentLoginIdentifier),
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

  const currentStepIndex = STEP_ORDER.indexOf(currentStep)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-8">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-indigo-600 mb-2">Créer un compte élève</h1>

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
          <StudentAdministrativeStep
            administrativeData={administrativeData}
            onChange={handleAdministrativeChange}
            onEmailBlur={checkEmail}
            checkEmailError={checkEmailError}
            isEmailAlreadyUsed={isEmailAlreadyUsed}
            onSubmit={handleAdministrativeNext}
          >
            <LinkedAccountSection
              relation="parent"
              data={linkedParentData}
              onChange={setLinkedParentData}
              lockedLoginIdentifier={lockedParentLoginIdentifier}
            />
          </StudentAdministrativeStep>
        )}

        {currentStep === 'rgpd' && (
          <RegistrationRgpdStep
            rgpdData={rgpdData}
            onRgpdChange={(field, value) => setRgpdData((prev) => ({ ...prev, [field]: value }))}
            onBack={() => setCurrentStep('administrative')}
            onSubmit={handleFinalSubmit}
            isSubmitting={isSubmitting}
            submitLabel="Créer mon compte"
            submittingLabel="Création…"
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
