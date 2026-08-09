/**
 * Tests for StudentRegistrationPage
 *
 * Covers:
 * - Form rendering (step 1: administrative, step 2: RGPD)
 * - Password mismatch validation
 * - Progress through wizard steps
 * - Successful registration calls registerStudent and redirects to /login
 * - RGPD consent validation (both required)
 * - API error displayed
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import StudentRegistrationPage from '../../src/pages/StudentRegistrationPage'

vi.mock('../../src/api/accounts')
import { registerStudent, checkEmailAvailability } from '../../src/api/accounts'
const mockRegisterStudent = vi.mocked(registerStudent)
const mockCheckEmailAvailability = vi.mocked(checkEmailAvailability)

function renderStudentRegistrationPage(initialEntry: string = '/register/student') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
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

/** Selects the "create a new linked parent account" mode and fills its fields. */
async function selectNewLinkedParentMode(options: { loginIdentifier?: string } = {}) {
  await userEvent.click(
    screen.getByRole('radio', { name: /créer un nouveau compte parent financeur lié/i }),
  )
  await userEvent.type(screen.getByLabelText(/prénom parent financeur/i), 'Marie')
  await userEvent.type(screen.getByLabelText(/^nom parent financeur$/i), 'Dupont')
  await userEvent.type(screen.getByLabelText(/email parent financeur/i), 'marie@test.com')
  const loginIdentifier = options.loginIdentifier ?? 'marie.dupont'
  if (loginIdentifier) {
    await userEvent.type(
      screen.getByLabelText(/identifiant de connexion parent financeur/i),
      loginIdentifier,
    )
  }
}

/** Moves on to step 2, accepts both consents and submits the registration. */
async function submitRgpdStep() {
  await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
  await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

  const checkboxes = screen.getAllByRole('checkbox')
  await userEvent.click(checkboxes[0])
  await userEvent.click(checkboxes[1])
  await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckEmailAvailability.mockResolvedValue({ alreadyUsed: false, suggestedLoginIdentifier: '' })
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

  it('does not call registerStudent when RGPD consents are not accepted', async () => {
    mockRegisterStudent.mockResolvedValue(undefined)
    renderStudentRegistrationPage()

    await fillAdministrativeStep()
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
    await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

    // Click submit without checking the required consent checkboxes
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    // The form has required checkboxes, so the API must NOT be called
    await waitFor(() => {
      expect(mockRegisterStudent).not.toHaveBeenCalled()
    })
  })

  it('calls registerStudent with the correct payload on final submit', async () => {
    mockRegisterStudent.mockResolvedValue(undefined)
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
      expect(mockRegisterStudent).toHaveBeenCalledWith(
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
    mockRegisterStudent.mockResolvedValue(undefined)
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
    mockRegisterStudent.mockRejectedValue({
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

  it('surfaces a visible error when the email availability check fails, without blocking the wizard', async () => {
    mockCheckEmailAvailability.mockRejectedValue({
      response: { data: { message: "Vérification de l'email indisponible" } },
    })
    renderStudentRegistrationPage()

    await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'alice@test.com')
    await userEvent.tab()

    await waitFor(() => {
      expect(screen.getByText("Vérification de l'email indisponible")).toBeDefined()
    })

    // The nominal wizard flow must not be blocked by the check-email failure.
    await userEvent.type(screen.getByPlaceholderText(/prénom/i), 'Alice')
    await userEvent.type(screen.getByPlaceholderText(/nom de famille/i), 'Dupont')
    await userEvent.type(screen.getByPlaceholderText(/8 caractères minimum/i), 'password123')
    await userEvent.type(screen.getByPlaceholderText(/répétez le mot de passe/i), 'password123')
    await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /consentements rgpd/i })).toBeDefined()
    })
  })

  describe('Linked parent account (LinkedAccountSection)', () => {
    it('renders the "link a parent" section with no mode selected by default', () => {
      renderStudentRegistrationPage()

      expect(screen.getByText(/lier un compte parent financeur \(optionnel\)/i)).toBeDefined()
      expect(screen.getByRole('radio', { name: /ne rien lier maintenant/i })).toHaveProperty('checked', true)
    })

    it('does not send any parent-linking field when nothing is filled (nominal, non-regression)', async () => {
      mockRegisterStudent.mockResolvedValue(undefined)
      renderStudentRegistrationPage()

      await fillAdministrativeStep()
      await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
      await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0])
      await userEvent.click(checkboxes[1])
      await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

      await waitFor(() => {
        expect(mockRegisterStudent).toHaveBeenCalled()
      })
      const payload = mockRegisterStudent.mock.calls[0][0]
      expect(payload.parentAccountMode).toBeUndefined()
      expect(payload.parentLoginIdentifier).toBeUndefined()
      expect(payload.parentEmail).toBeUndefined()
    })

    it('sends parentLoginIdentifier when linking to an existing parent account', async () => {
      mockRegisterStudent.mockResolvedValue(undefined)
      renderStudentRegistrationPage()

      await fillAdministrativeStep()
      await userEvent.click(screen.getByRole('radio', { name: /lier un compte parent financeur existant/i }))
      await userEvent.type(
        screen.getByLabelText(/identifiant parent financeur/i),
        'marie.dupont',
      )
      await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
      await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0])
      await userEvent.click(checkboxes[1])
      await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

      await waitFor(() => {
        expect(mockRegisterStudent).toHaveBeenCalledWith(
          expect.objectContaining({
            parentAccountMode: 'existing',
            parentLoginIdentifier: 'marie.dupont',
          }),
        )
      })
    })

    it('blocks advancing to step 2 when "existing" is selected without an identifier', async () => {
      renderStudentRegistrationPage()

      await fillAdministrativeStep()
      await userEvent.click(screen.getByRole('radio', { name: /lier un compte parent financeur existant/i }))
      await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

      await waitFor(() => {
        expect(screen.getByText(/identifiant du parent financeur à lier/i)).toBeDefined()
        // still on step 1
        expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
      })
    })

    it('offers a login identifier field for the parent account being created', async () => {
      renderStudentRegistrationPage()

      await userEvent.click(
        screen.getByRole('radio', { name: /créer un nouveau compte parent financeur lié/i }),
      )

      expect(screen.getByLabelText(/identifiant de connexion parent financeur/i)).toBeDefined()
      expect(screen.getByText(/cet identifiant lui servira à se connecter/i)).toBeDefined()
    })

    it('sends the chosen login identifier with the new linked parent account', async () => {
      mockRegisterStudent.mockResolvedValue(undefined)
      renderStudentRegistrationPage()

      await fillAdministrativeStep()
      await selectNewLinkedParentMode()
      await submitRgpdStep()

      await waitFor(() => {
        expect(mockRegisterStudent).toHaveBeenCalledWith(
          expect.objectContaining({
            parentAccountMode: 'new',
            parentLoginIdentifier: 'marie.dupont',
            parentEmail: 'marie@test.com',
            parentFirstName: 'Marie',
            parentLastName: 'Dupont',
          }),
        )
      })
    })

    it('locks the parent link to ?parentLoginIdentifier= from the URL, with no mode choice', async () => {
      mockRegisterStudent.mockResolvedValue(undefined)
      renderStudentRegistrationPage('/register/student?parentLoginIdentifier=marie.dupont')

      expect(screen.getByText(/lié automatiquement/i)).toBeDefined()
      expect(screen.queryByRole('radio', { name: /ne rien lier maintenant/i })).toBeNull()

      await fillAdministrativeStep()
      await userEvent.click(screen.getByRole('button', { name: /suivant/i }))
      await waitFor(() => screen.getByRole('heading', { name: /consentements rgpd/i }))

      const checkboxes = screen.getAllByRole('checkbox')
      await userEvent.click(checkboxes[0])
      await userEvent.click(checkboxes[1])
      await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

      await waitFor(() => {
        expect(mockRegisterStudent).toHaveBeenCalledWith(
          expect.objectContaining({
            parentAccountMode: 'existing',
            parentLoginIdentifier: 'marie.dupont',
          }),
        )
      })
    })

    it('blocks advancing to step 2 when "new" is selected without a login identifier', async () => {
      renderStudentRegistrationPage()

      await fillAdministrativeStep()
      await selectNewLinkedParentMode({ loginIdentifier: '' })
      await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

      await waitFor(() => {
        expect(
          screen.getByText(/identifiant de connexion du parent financeur est requis/i),
        ).toBeDefined()
      })
      // still on step 1
      expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    })

    it('blocks advancing to step 2 when the linked login identifier duplicates the main one', async () => {
      renderStudentRegistrationPage()

      await fillAdministrativeStep()
      await userEvent.type(screen.getByLabelText(/^identifiant de connexion$/i), 'alice.dupont')
      await selectNewLinkedParentMode({ loginIdentifier: 'alice.dupont' })
      await userEvent.click(screen.getByRole('button', { name: /suivant/i }))

      await waitFor(() => {
        expect(screen.getByText(/différent du vôtre/i)).toBeDefined()
      })
    })
  })

  describe('Server errors on a registration with a linked parent account', () => {
    it('names the linked account when the server rejects its login identifier (409)', async () => {
      mockRegisterStudent.mockRejectedValue({
        response: { status: 409, data: { message: 'parentLoginIdentifier already taken' } },
      })
      renderStudentRegistrationPage()

      await fillAdministrativeStep()
      await userEvent.type(screen.getByLabelText(/^identifiant de connexion$/i), 'alice.dupont')
      await selectNewLinkedParentMode()
      await submitRgpdStep()

      await waitFor(() => {
        expect(
          screen.getByText(/compte parent financeur lié est déjà utilisé/i),
        ).toBeDefined()
      })
    })

    it('names the main account when the server rejects the main login identifier (409)', async () => {
      mockRegisterStudent.mockRejectedValue({
        response: { status: 409, data: { message: "L'identifiant alice.dupont est déjà pris" } },
      })
      renderStudentRegistrationPage()

      await fillAdministrativeStep()
      await userEvent.type(screen.getByLabelText(/^identifiant de connexion$/i), 'alice.dupont')
      await selectNewLinkedParentMode()
      await submitRgpdStep()

      await waitFor(() => {
        const message = screen.getByText(/identifiant de connexion « alice.dupont » est déjà utilisé/i)
        expect(message).toBeDefined()
      })
    })

    it('explains a 404 as an unknown parent account to attach', async () => {
      mockRegisterStudent.mockRejectedValue({ response: { status: 404, data: {} } })
      renderStudentRegistrationPage()

      await fillAdministrativeStep()
      await userEvent.click(
        screen.getByRole('radio', { name: /lier un compte parent financeur existant/i }),
      )
      await userEvent.type(screen.getByLabelText(/identifiant parent financeur/i), 'marie.dupont')
      await submitRgpdStep()

      await waitFor(() => {
        expect(screen.getByText(/aucun compte parent financeur ne correspond/i)).toBeDefined()
      })
    })

    it('explains a 400 as inconsistent linked-account fields', async () => {
      mockRegisterStudent.mockRejectedValue({
        response: { status: 400, data: { message: ['parentEmail should not exist'] } },
      })
      renderStudentRegistrationPage()

      await fillAdministrativeStep()
      await selectNewLinkedParentMode()
      await submitRgpdStep()

      await waitFor(() => {
        expect(
          screen.getByText(/compte parent financeur lié sont incomplètes ou incohérentes/i),
        ).toBeDefined()
      })
    })
  })
})
