/**
 * Tests for TeacherRegistrationPage
 *
 * Covers:
 * - Form rendering (2-step wizard: administrative, RGPD)
 * - Step navigation (next and back)
 * - RGPD consent required before submission
 * - Calls registerTeacher with the server contract for `consents`
 * - No longer sends the pedagogical fields, which the server never stored
 * - Redirects to /login after success
 * - API error displayed, including the "unknown fields" 400
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import TeacherRegistrationPage from '../../src/pages/TeacherRegistrationPage'

vi.mock('../../src/api/accounts')
import { registerTeacher, checkEmailAvailability } from '../../src/api/accounts'
const mockRegisterTeacher = vi.mocked(registerTeacher)
const mockCheckEmailAvailability = vi.mocked(checkEmailAvailability)

function renderTeacherRegistrationPage() {
  return render(
    <MemoryRouter initialEntries={['/register/teacher']}>
      <Routes>
        <Route path="/register/teacher" element={<TeacherRegistrationPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillAdministrativeStep(options: { confirmPassword?: string } = {}) {
  await userEvent.type(screen.getByPlaceholderText(/prénom/i), 'Marc')
  await userEvent.type(screen.getByPlaceholderText(/nom de famille/i), 'Martin')
  await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'marc@teacher.com')
  await userEvent.type(screen.getByPlaceholderText(/8 caractères minimum/i), 'password123')
  await userEvent.type(
    screen.getByPlaceholderText(/répétez le mot de passe/i),
    options.confirmPassword ?? 'password123',
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckEmailAvailability.mockResolvedValue({ alreadyUsed: false, suggestedLoginIdentifier: '' })
})

describe('TeacherRegistrationPage', () => {
  it('renders the title with a message about RP validation', () => {
    renderTeacherRegistrationPage()

    expect(screen.getByText(/créer un compte formateur/i)).toBeDefined()
    expect(screen.getByText(/responsable pédagogique/i)).toBeDefined()
  })

  it('renders administrative fields on step 1', () => {
    renderTeacherRegistrationPage()

    expect(screen.getByPlaceholderText(/prénom/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/nom de famille/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
  })

  it('shows password mismatch error when passwords differ', async () => {
    renderTeacherRegistrationPage()

    await userEvent.type(screen.getByPlaceholderText(/prénom/i), 'Marc')
    await userEvent.type(screen.getByPlaceholderText(/nom de famille/i), 'Martin')
    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'marc@teacher.com')
    await userEvent.type(screen.getByPlaceholderText(/8 caractères minimum/i), 'password123')
    await userEvent.type(screen.getByPlaceholderText(/répétez le mot de passe/i), 'different123')
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

    await waitFor(() => {
      expect(screen.getByText(/mots de passe ne correspondent pas/i)).toBeDefined()
    })
  })

  it('advances directly to the consents step after step 1', async () => {
    renderTeacherRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /consentements rgpd/i })).toBeDefined()
      expect(screen.getByText(/protection des données personnelles/i)).toBeDefined()
    })
  })

  it('no longer offers the pedagogical fields, which the server never stored', async () => {
    renderTeacherRegistrationPage()

    expect(screen.queryByPlaceholderText(/ex: mathématiques/i)).toBeNull()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    expect(screen.queryByRole('heading', { name: /profil pédagogique/i })).toBeNull()
    expect(screen.queryByPlaceholderText(/ex: mathématiques/i)).toBeNull()
  })

  it('tells the applicant where the pedagogical profile is filled in instead', () => {
    renderTeacherRegistrationPage()

    expect(screen.getByText(/profil pédagogique.*après connexion/i)).toBeDefined()
  })

  it('can navigate back from the consents step to step 1', async () => {
    renderTeacherRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    await userEvent.click(screen.getByRole('button', { name: /retour/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    })
  })

  it('calls registerTeacher with the correct payload', async () => {
    mockRegisterTeacher.mockResolvedValue(undefined)
    renderTeacherRegistrationPage()

    // Step 1
    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    // Step 2
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[1])
    await userEvent.click(screen.getByRole('button', { name: /soumettre ma candidature/i }))

    await waitFor(() => {
      expect(mockRegisterTeacher).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'marc@teacher.com',
          password: 'password123',
          firstName: 'Marc',
          lastName: 'Martin',
          // Contrat serveur : tableau d'objets, identique au corps de POST /consents.
          consents: [{ consentType: 'rgpd' }, { consentType: 'cgu' }],
        }),
      )
    })

    // Champs que le serveur refuse désormais explicitement (400) : jamais transmis.
    const payload = mockRegisterTeacher.mock.calls[0][0] as Record<string, unknown>
    expect(payload.teachingSubjects).toBeUndefined()
    expect(payload.educationLevel).toBeUndefined()
    expect(payload.bio).toBeUndefined()
  })

  it('redirects to /login after successful submission', async () => {
    mockRegisterTeacher.mockResolvedValue(undefined)
    renderTeacherRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[1])
    await userEvent.click(screen.getByRole('button', { name: /soumettre ma candidature/i }))

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeDefined()
    })
  })

  it('displays API error on failure', async () => {
    mockRegisterTeacher.mockRejectedValue({
      response: { data: { message: 'Email déjà utilisé' } },
    })
    renderTeacherRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[1])
    await userEvent.click(screen.getByRole('button', { name: /soumettre ma candidature/i }))

    await waitFor(() => {
      expect(screen.getByText('Email déjà utilisé')).toBeDefined()
    })
  })

  it('surfaces a visible error when the email availability check fails, without blocking the wizard', async () => {
    mockCheckEmailAvailability.mockRejectedValue({
      response: { data: { message: "Vérification de l'email indisponible" } },
    })
    renderTeacherRegistrationPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'marc@teacher.com')
    await userEvent.tab()

    await waitFor(() => {
      expect(screen.getByText("Vérification de l'email indisponible")).toBeDefined()
    })

    // The nominal wizard flow must not be blocked by the check-email failure.
    await userEvent.type(screen.getByPlaceholderText(/prénom/i), 'Marc')
    await userEvent.type(screen.getByPlaceholderText(/nom de famille/i), 'Martin')
    await userEvent.type(screen.getByPlaceholderText(/8 caractères minimum/i), 'password123')
    await userEvent.type(screen.getByPlaceholderText(/répétez le mot de passe/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /consentements rgpd/i })).toBeDefined()
    })
  })

  it('explains an "unknown fields" 400 as a front/server mismatch, without showing field names', async () => {
    mockRegisterTeacher.mockRejectedValue({
      response: {
        status: 400,
        data: {
          message:
            'Unknown field(s): teachingSubjects, bio. Accepted fields for this route: email, password, firstName, lastName, phoneNumber, loginIdentifier, cvReference, consents.',
        },
      },
    })
    renderTeacherRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[1])
    await userEvent.click(screen.getByRole('button', { name: /soumettre ma candidature/i }))

    await waitFor(() => {
      expect(screen.getByText(/n'est plus à jour avec le serveur/i)).toBeDefined()
    })
    expect(screen.queryByText(/teachingSubjects/)).toBeNull()
  })

  /**
   * Consentement marketing — optionnel (docs/routes.md : `rgpd` requis, `cgu` requis,
   * `marketing` optionnel). Il ne doit jamais être pré-coché ni bloquer la candidature,
   * et aucune entrée `marketing` ne doit partir tant qu'il n'a pas été coché.
   */
  describe('consentement marketing (optionnel)', () => {
    /** Amène à l'étape 2 et coche les deux consentements obligatoires. */
    async function goToConsentsStepAndAcceptRequired() {
      await fillAdministrativeStep()
      await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
      await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0]) // RGPD
      await userEvent.click(checkboxes[1]) // CGU
    }

    function getMarketingCheckbox() {
      return screen.getByRole('checkbox', { name: /marketing/i })
    }

    it('affiche la case marketing, décochée et non obligatoire, avec les libellés de /consents', async () => {
      renderTeacherRegistrationPage()

      await fillAdministrativeStep()
      await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
      await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

      const marketingCheckbox = getMarketingCheckbox() as HTMLInputElement
      expect(marketingCheckbox.checked).toBe(false)
      expect(marketingCheckbox.required).toBe(false)
      expect(screen.getByText(/marketing \(optionnel\)/i)).toBeDefined()
      expect(screen.getByText(/recevoir des communications commerciales/i)).toBeDefined()
    })

    it('transmet le consentement marketing quand la case est cochée', async () => {
      mockRegisterTeacher.mockResolvedValue(undefined)
      renderTeacherRegistrationPage()

      await goToConsentsStepAndAcceptRequired()
      await userEvent.click(getMarketingCheckbox())
      await userEvent.click(screen.getByRole('button', { name: /soumettre ma candidature/i }))

      await waitFor(() => {
        expect(mockRegisterTeacher).toHaveBeenCalledWith(
          expect.objectContaining({
            consents: [
              { consentType: 'rgpd' },
              { consentType: 'cgu' },
              { consentType: 'marketing' },
            ],
          }),
        )
      })
      // La candidature aboutit avec le consentement marketing.
      await waitFor(() => expect(screen.getByText('Login Page')).toBeDefined())
    })

    it("n'envoie aucune entrée marketing quand la case reste décochée", async () => {
      mockRegisterTeacher.mockResolvedValue(undefined)
      renderTeacherRegistrationPage()

      await goToConsentsStepAndAcceptRequired()
      await userEvent.click(screen.getByRole('button', { name: /soumettre ma candidature/i }))

      await waitFor(() => expect(mockRegisterTeacher).toHaveBeenCalled())

      const payload = mockRegisterTeacher.mock.calls[0][0] as {
        consents?: { consentType: string }[]
      }
      expect(payload.consents).toEqual([{ consentType: 'rgpd' }, { consentType: 'cgu' }])
      expect(payload.consents?.some((consent) => consent.consentType === 'marketing')).toBe(false)
      // La candidature aboutit aussi sans le consentement marketing.
      await waitFor(() => expect(screen.getByText('Login Page')).toBeDefined())
    })

    it('ne débloque pas la candidature à lui seul : RGPD et CGU restent obligatoires', async () => {
      mockRegisterTeacher.mockResolvedValue(undefined)
      renderTeacherRegistrationPage()

      await fillAdministrativeStep()
      await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
      await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

      await userEvent.click(getMarketingCheckbox())
      await userEvent.click(screen.getByRole('button', { name: /soumettre ma candidature/i }))

      await waitFor(() => {
        expect(mockRegisterTeacher).not.toHaveBeenCalled()
      })
    })
  })
})
