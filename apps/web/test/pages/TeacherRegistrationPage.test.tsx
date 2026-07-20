/**
 * Tests for TeacherRegistrationPage
 *
 * Covers:
 * - Form rendering (3-step wizard: administrative, pedagogical, RGPD)
 * - Step navigation (next and back)
 * - RGPD consent required before submission
 * - Calls registerTeacher on final submit
 * - Redirects to /login after success
 * - API error displayed
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

  it('advances to step 2 (pedagogical) on valid step 1', async () => {
    renderTeacherRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /profil pédagogique/i })).toBeDefined()
      expect(screen.getByPlaceholderText(/ex: mathématiques/i)).toBeDefined()
    })
  })

  it('advances to step 3 (RGPD) from step 2', async () => {
    renderTeacherRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /profil pédagogique/i }))

    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /consentements rgpd/i })).toBeDefined()
      expect(screen.getByText(/protection des données personnelles/i)).toBeDefined()
    })
  })

  it('can navigate back from step 2 to step 1', async () => {
    renderTeacherRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /profil pédagogique/i }))

    await userEvent.click(screen.getByRole('button', { name: /retour/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    })
  })

  it('can navigate back from step 3 to step 2', async () => {
    renderTeacherRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /profil pédagogique/i }))

    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    await userEvent.click(screen.getByRole('button', { name: /retour/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /profil pédagogique/i })).toBeDefined()
    })
  })

  it('calls registerTeacher with the correct payload', async () => {
    mockRegisterTeacher.mockResolvedValue(undefined)
    renderTeacherRegistrationPage()

    // Step 1
    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /profil pédagogique/i }))

    // Step 2
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    // Step 3
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
          consents: { rgpd: true, cgu: true },
        }),
      )
    })
  })

  it('redirects to /login after successful submission', async () => {
    mockRegisterTeacher.mockResolvedValue(undefined)
    renderTeacherRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /profil pédagogique/i }))

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
    await waitFor(() => screen.getByRole('heading', { name: /profil pédagogique/i }))

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
      expect(screen.getByRole('heading', { name: /profil pédagogique/i })).toBeDefined()
    })
  })
})
