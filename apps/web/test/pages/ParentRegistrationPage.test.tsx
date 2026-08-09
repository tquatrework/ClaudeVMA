/**
 * Tests for ParentRegistrationPage
 *
 * Covers:
 * - Form rendering (firstName, lastName, email, password, confirmPassword)
 * - Missing firstName/lastName validation
 * - Password mismatch validation
 * - Password too short validation
 * - Successful registration calls registerParent and redirects to /login
 * - API error displayed
 * - check-email failure is now surfaced (no longer swallowed silently)
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ParentRegistrationPage from '../../src/pages/ParentRegistrationPage'

vi.mock('../../src/api/accounts')
import { registerParent, checkEmailAvailability } from '../../src/api/accounts'
const mockRegisterParent = vi.mocked(registerParent)
const mockCheckEmailAvailability = vi.mocked(checkEmailAvailability)

function renderParentRegistrationPage(initialEntry: string = '/register/parent') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/register/parent" element={<ParentRegistrationPage />} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

async function fillForm(
  options: {
    firstName?: string
    lastName?: string
    password?: string
    confirmPassword?: string
    skipNames?: boolean
  } = {},
) {
  if (!options.skipNames) {
    await userEvent.type(screen.getByPlaceholderText(/^prénom$/i), options.firstName ?? 'Jean')
    await userEvent.type(screen.getByPlaceholderText(/nom de famille/i), options.lastName ?? 'Dupont')
  }
  await userEvent.type(screen.getByPlaceholderText(/vous@exemple\.fr/i), 'parent@test.com')
  await userEvent.type(
    screen.getByPlaceholderText(/8 caractères minimum/i),
    options.password ?? 'password123',
  )
  await userEvent.type(
    screen.getByPlaceholderText(/répétez le mot de passe/i),
    options.confirmPassword ?? 'password123',
  )
}

/** Selects the "create a new linked student account" mode and fills its fields. */
async function selectNewLinkedStudentMode(options: { loginIdentifier?: string } = {}) {
  await userEvent.click(screen.getByRole('radio', { name: /créer un nouveau compte élève lié/i }))
  await userEvent.type(screen.getByLabelText(/prénom élève/i), 'Lucas')
  await userEvent.type(screen.getByLabelText(/^nom élève$/i), 'Martin')
  await userEvent.type(screen.getByLabelText(/email élève/i), 'lucas@test.com')
  const loginIdentifier = options.loginIdentifier ?? 'lucas.martin'
  if (loginIdentifier) {
    await userEvent.type(
      screen.getByLabelText(/identifiant de connexion élève/i),
      loginIdentifier,
    )
  }
}

async function submitParentForm() {
  await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCheckEmailAvailability.mockResolvedValue({ alreadyUsed: false, suggestedLoginIdentifier: '' })
})

describe('ParentRegistrationPage', () => {
  it('renders the title and all form fields', () => {
    renderParentRegistrationPage()

    expect(screen.getByText(/créer un compte parent \/ financeur/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/^prénom$/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/nom de famille/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/vous@exemple\.fr/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/8 caractères minimum/i)).toBeDefined()
    expect(screen.getByPlaceholderText(/répétez le mot de passe/i)).toBeDefined()
    expect(screen.getByRole('button', { name: /créer mon compte/i })).toBeDefined()
  })

  it('does not call registerParent when firstName or lastName are missing', async () => {
    renderParentRegistrationPage()

    await fillForm({ skipNames: true })
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(mockRegisterParent).not.toHaveBeenCalled()
    })
  })

  it('shows error when passwords do not match', async () => {
    renderParentRegistrationPage()

    await fillForm({ password: 'password123', confirmPassword: 'different456' })
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText(/mots de passe ne correspondent pas/i)).toBeDefined()
    })
  })

  it('shows error when password is too short', async () => {
    renderParentRegistrationPage()

    await fillForm({ password: 'court', confirmPassword: 'court' })
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText(/au moins 8 caractères/i)).toBeDefined()
    })
  })

  it('calls registerParent with correct payload on valid submit', async () => {
    mockRegisterParent.mockResolvedValue(undefined)
    renderParentRegistrationPage()

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(mockRegisterParent).toHaveBeenCalledWith({
        email: 'parent@test.com',
        loginIdentifier: undefined,
        password: 'password123',
        firstName: 'Jean',
        lastName: 'Dupont',
      })
    })
  })

  it('redirects to /login after successful registration', async () => {
    mockRegisterParent.mockResolvedValue(undefined)
    renderParentRegistrationPage()

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText('Login Page')).toBeDefined()
    })
  })

  it('displays API error message on submission failure', async () => {
    mockRegisterParent.mockRejectedValue({
      response: { data: { message: 'Email déjà utilisé' } },
    })
    renderParentRegistrationPage()

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText('Email déjà utilisé')).toBeDefined()
    })
  })

  it('displays a generic error message when API response has no message', async () => {
    mockRegisterParent.mockRejectedValue(new Error('Network error'))
    renderParentRegistrationPage()

    await fillForm()
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(screen.getByText(/erreur lors de la création du compte/i)).toBeDefined()
    })
  })

  it('surfaces a visible error when the email availability check fails, without blocking the form', async () => {
    mockCheckEmailAvailability.mockRejectedValue({
      response: { data: { message: "Vérification de l'email indisponible" } },
    })
    mockRegisterParent.mockResolvedValue(undefined)
    renderParentRegistrationPage()

    const emailInput = screen.getByPlaceholderText(/vous@exemple\.fr/i)
    await userEvent.type(emailInput, 'parent@test.com')
    await userEvent.tab() // triggers onBlur

    await waitFor(() => {
      expect(screen.getByText("Vérification de l'email indisponible")).toBeDefined()
    })

    // The nominal flow must not be blocked by the check-email failure.
    await userEvent.type(screen.getByPlaceholderText(/^prénom$/i), 'Jean')
    await userEvent.type(screen.getByPlaceholderText(/nom de famille/i), 'Dupont')
    await userEvent.type(
      screen.getByPlaceholderText(/8 caractères minimum/i),
      'password123',
    )
    await userEvent.type(
      screen.getByPlaceholderText(/répétez le mot de passe/i),
      'password123',
    )
    await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

    await waitFor(() => {
      expect(mockRegisterParent).toHaveBeenCalled()
    })
  })

  describe('Linked student account (LinkedAccountSection)', () => {
    it('renders the "link a student" section with no mode selected by default', () => {
      renderParentRegistrationPage()

      expect(screen.getByText(/lier un compte élève \(optionnel\)/i)).toBeDefined()
      expect(screen.getByRole('radio', { name: /ne rien lier maintenant/i })).toHaveProperty('checked', true)
    })

    it('does not send any student-linking field when nothing is filled (nominal, non-regression)', async () => {
      mockRegisterParent.mockResolvedValue(undefined)
      renderParentRegistrationPage()

      await fillForm()
      await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

      await waitFor(() => {
        expect(mockRegisterParent).toHaveBeenCalled()
      })
      const payload = mockRegisterParent.mock.calls[0][0]
      expect(payload.studentAccountMode).toBeUndefined()
      expect(payload.studentLoginIdentifier).toBeUndefined()
      expect(payload.studentEmail).toBeUndefined()
    })

    it('sends studentAccountMode + studentLoginIdentifier when linking to an existing student account', async () => {
      mockRegisterParent.mockResolvedValue(undefined)
      renderParentRegistrationPage()

      await fillForm()
      await userEvent.click(screen.getByRole('radio', { name: /lier un compte élève existant/i }))
      await userEvent.type(screen.getByLabelText(/identifiant élève/i), 'lucas.martin')
      await submitParentForm()

      await waitFor(() => {
        expect(mockRegisterParent).toHaveBeenCalledWith(
          expect.objectContaining({
            studentAccountMode: 'existing',
            studentLoginIdentifier: 'lucas.martin',
          }),
        )
      })
    })

    it('blocks submission when "existing" is selected without an identifier', async () => {
      renderParentRegistrationPage()

      await fillForm()
      await userEvent.click(screen.getByRole('radio', { name: /lier un compte élève existant/i }))
      await userEvent.click(screen.getByRole('button', { name: /créer mon compte/i }))

      await waitFor(() => {
        expect(screen.getByText(/identifiant de l'élève à lier/i)).toBeDefined()
      })
      expect(mockRegisterParent).not.toHaveBeenCalled()
    })

    it('offers a login identifier field for the student account being created', async () => {
      renderParentRegistrationPage()

      await userEvent.click(screen.getByRole('radio', { name: /créer un nouveau compte élève lié/i }))

      expect(screen.getByLabelText(/identifiant de connexion élève/i)).toBeDefined()
      expect(screen.getByText(/cet identifiant lui servira à se connecter/i)).toBeDefined()
    })

    it('sends the chosen login identifier with the new linked student account', async () => {
      mockRegisterParent.mockResolvedValue(undefined)
      renderParentRegistrationPage()

      await fillForm()
      await selectNewLinkedStudentMode()
      await submitParentForm()

      await waitFor(() => {
        expect(mockRegisterParent).toHaveBeenCalledWith(
          expect.objectContaining({
            studentAccountMode: 'new',
            studentLoginIdentifier: 'lucas.martin',
            studentEmail: 'lucas@test.com',
            studentFirstName: 'Lucas',
            studentLastName: 'Martin',
          }),
        )
      })
    })

    it('blocks submission when "new" is selected without a login identifier', async () => {
      renderParentRegistrationPage()

      await fillForm()
      await selectNewLinkedStudentMode({ loginIdentifier: '' })
      await submitParentForm()

      await waitFor(() => {
        expect(screen.getByText(/identifiant de connexion de l'élève est requis/i)).toBeDefined()
      })
      expect(mockRegisterParent).not.toHaveBeenCalled()
    })

    it('blocks submission when the linked login identifier duplicates the main one', async () => {
      renderParentRegistrationPage()

      await fillForm()
      await userEvent.type(screen.getByLabelText(/^identifiant de connexion$/i), 'lucas.martin')
      await selectNewLinkedStudentMode({ loginIdentifier: 'lucas.martin' })
      await submitParentForm()

      await waitFor(() => {
        expect(screen.getByText(/différent du vôtre/i)).toBeDefined()
      })
      expect(mockRegisterParent).not.toHaveBeenCalled()
    })

    it('locks the student link to ?studentLoginIdentifier= from the URL, in "existing" mode', async () => {
      mockRegisterParent.mockResolvedValue(undefined)
      renderParentRegistrationPage('/register/parent?studentLoginIdentifier=lucas.martin')

      expect(screen.getByText(/lié automatiquement/i)).toBeDefined()
      expect(screen.queryByRole('radio', { name: /ne rien lier maintenant/i })).toBeNull()

      await fillForm()
      await submitParentForm()

      await waitFor(() => {
        expect(mockRegisterParent).toHaveBeenCalledWith(
          expect.objectContaining({
            studentAccountMode: 'existing',
            studentLoginIdentifier: 'lucas.martin',
          }),
        )
      })
    })
  })

  describe('Main account login identifier', () => {
    it('sends the login identifier typed for the parent account itself', async () => {
      mockRegisterParent.mockResolvedValue(undefined)
      renderParentRegistrationPage()

      await fillForm()
      await userEvent.type(screen.getByLabelText(/^identifiant de connexion$/i), 'jean.dupont')
      await submitParentForm()

      await waitFor(() => {
        expect(mockRegisterParent).toHaveBeenCalledWith(
          expect.objectContaining({ loginIdentifier: 'jean.dupont' }),
        )
      })
    })
  })

  describe('Server errors on a registration with a linked student account', () => {
    it('names the linked account when the server rejects its login identifier (409)', async () => {
      mockRegisterParent.mockRejectedValue({
        response: { status: 409, data: { message: 'studentLoginIdentifier already taken' } },
      })
      renderParentRegistrationPage()

      await fillForm()
      await userEvent.type(screen.getByLabelText(/^identifiant de connexion$/i), 'jean.dupont')
      await selectNewLinkedStudentMode()
      await submitParentForm()

      await waitFor(() => {
        expect(screen.getByText(/compte élève lié est déjà utilisé/i)).toBeDefined()
      })
    })

    it('names the main account when the server rejects the main login identifier (409)', async () => {
      mockRegisterParent.mockRejectedValue({
        response: { status: 409, data: { message: "L'identifiant jean.dupont est déjà pris" } },
      })
      renderParentRegistrationPage()

      await fillForm()
      await userEvent.type(screen.getByLabelText(/^identifiant de connexion$/i), 'jean.dupont')
      await selectNewLinkedStudentMode()
      await submitParentForm()

      await waitFor(() => {
        expect(
          screen.getByText(/identifiant de connexion « jean.dupont » est déjà utilisé/i),
        ).toBeDefined()
      })
    })

    it('explains a 404 as an unknown student account to attach', async () => {
      mockRegisterParent.mockRejectedValue({ response: { status: 404, data: {} } })
      renderParentRegistrationPage()

      await fillForm()
      await userEvent.click(screen.getByRole('radio', { name: /lier un compte élève existant/i }))
      await userEvent.type(screen.getByLabelText(/identifiant élève/i), 'lucas.martin')
      await submitParentForm()

      await waitFor(() => {
        expect(screen.getByText(/aucun compte élève ne correspond/i)).toBeDefined()
      })
    })

    it('explains a 400 as inconsistent linked-account fields', async () => {
      mockRegisterParent.mockRejectedValue({
        response: { status: 400, data: { message: ['studentEmail should not exist'] } },
      })
      renderParentRegistrationPage()

      await fillForm()
      await selectNewLinkedStudentMode()
      await submitParentForm()

      await waitFor(() => {
        expect(screen.getByText(/compte élève lié sont incomplètes ou incohérentes/i)).toBeDefined()
      })
    })
  })
})
