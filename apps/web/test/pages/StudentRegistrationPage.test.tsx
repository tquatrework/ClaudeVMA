/**
 * Tests for StudentRegistrationPage
 *
 * Covers:
 * - Form rendering (step 1: administrative, step 2: RGPD)
 * - Password mismatch validation
 * - Progress through wizard steps
 * - Successful registration calls POST /accounts/students and redirects to /login
 * - RGPD consent validation (both required)
 * - API error displayed
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StudentRegistrationPage from '../../src/pages/StudentRegistrationPage'

vi.mock('../../src/api/client')
import apiClient from '../../src/api/client'
const mockApiClient = vi.mocked(apiClient)

function renderStudentRegistrationPage() {
  return render(
    <MemoryRouter initialEntries={['/register/student']}>
      <Routes>
        <Route path="/register/student" element={<StudentRegistrationPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillAdministrativeStep(options: { confirmPassword?: string } = {}) {
  await userEvent.type(screen.getByPlaceholderText(/prénom/i), 'Alice')
  await userEvent.type(screen.getByPlaceholderText(/nom de famille/i), 'Dupont')
  await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'alice@test.com')
  await userEvent.type(screen.getByPlaceholderText(/8 caractères minimum/i), 'password123')
  await userEvent.type(
    screen.getByPlaceholderText(/répétez le mot de passe/i),
    options.confirmPassword ?? 'password123',
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('StudentRegistrationPage', () => {
  it('renders the title and administrative fields on step 1', () => {
    renderStudentRegistrationPage()

    expect(screen.getByText(/créer un compte élève/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/prénom/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/nom de famille/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/8 caractères minimum/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/répétez le mot de passe/i)).toBeDefined()
  })

  it('shows password mismatch error and stays on step 1', async () => {
    renderStudentRegistrationPage()

    await fillAdministrativeStep({ confirmPassword: 'different123' })
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

    await waitFor(() => {
      expect(screen.getByText(/mots de passe ne correspondent pas/i)).toBeDefined()
      // still on step 1 — email field still visible
      expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    })
  })

  it('advances to step 2 (RGPD) when step 1 is valid', async () => {
    renderStudentRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

    await waitFor(() => {
      // Step 2 heading (inside <h2>) — use role=heading to differentiate from progress bar
      expect(screen.getByRole('heading', { name: /consentements rgpd/i })).toBeDefined()
      expect(screen.getByText(/protection des données personnelles/i)).toBeDefined()
    })
  })

  it('can navigate back to step 1 from step 2', async () => {
    renderStudentRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('button', { name: /retour/i }))

    await userEvent.click(screen.getByRole('button', { name: /retour/i }))

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    })
  })

  it('does not call POST /accounts/students when RGPD consents are not accepted', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })
    renderStudentRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    // Click submit without checking the required consent checkboxes
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    // The form has required checkboxes, so the API must NOT be called
    await waitFor(() => {
      expect(mockApiClient.post).not.toHaveBeenCalled()
    })
  })

  it('calls POST /accounts/students with the correct payload on final submit', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })
    renderStudentRegistrationPage()

    // Step 1
    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    // Step 2 — check both required consents
    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0]) // RGPD
    await userEvent.click(checkboxes[1]) // CGU
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        '/accounts/students',
        expect.objectContaining({
          email: 'alice@test.com',
          password: 'password123',
          firstName: 'Alice',
          lastName: 'Dupont',
          consents: { rgpd: true, cgu: true },
        }),
      )
    })
  })

  it('redirects to /login after successful registration', async () => {
    mockApiClient.post = vi.fn().mockResolvedValue({ data: {} })
    renderStudentRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[1])
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeDefined()
    })
  })

  it('displays API error on submission failure', async () => {
    mockApiClient.post = vi.fn().mockRejectedValue({
      response: { data: { message: 'Email déjà utilisé' } },
    })
    renderStudentRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    const checkboxes = screen.getAllByRole('checkbox')
    await userEvent.click(checkboxes[0])
    await userEvent.click(checkboxes[1])
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText('Email déjà utilisé')).toBeDefined()
    })
  })
})
