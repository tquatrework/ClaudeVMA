/**
 * Tests for RegisterPage
 *
 * RegisterPage is now a role selection entry point that routes users to the
 * appropriate specialized wizard (student, teacher, parent).
 *
 * Covers:
 * - Renders all three role options
 * - Navigates to /register/student when clicking Élève
 * - Navigates to /register/teacher when clicking Formateur
 * - Has a link back to login page
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import RegisterPage from '../../src/pages/RegisterPage'

vi.mock('../../src/api/client')

function renderRegisterPage() {
  return render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/register/student" element={<div>Student Registration Page</div>} />
        <Route path="/register/teacher" element={<div>Teacher Registration Page</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('RegisterPage', () => {
  it('renders the page title', () => {
    renderRegisterPage()
    expect(screen.getByText(/créer un compte/i)).toBeDefined()
  })

  it('renders role options including Formateur and Parent/Financeur', () => {
    renderRegisterPage()

    // Use getByRole to find buttons since roles appear as button text
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText(/parent.*financeur/i)).toBeDefined()
  })

  it('shows a link to the login page', () => {
    renderRegisterPage()
    expect(screen.getByRole('link', { name: /se connecter/i })).toBeDefined()
  })

  it('navigates to /register/student when clicking the Élève option', async () => {
    renderRegisterPage()

    // Find all buttons and click the one whose first text node is "Élève"
    const allButtons = screen.getAllByRole('button')
    const eleveButton = allButtons.find(btn => btn.querySelector('p')?.textContent === 'Élève')
    expect(eleveButton).toBeDefined()
    await userEvent.click(eleveButton!)

    await waitFor(() => {
      expect(screen.getByText('Student Registration Page')).toBeDefined()
    })
  })

  it('navigates to /register/teacher when clicking the Formateur option', async () => {
    renderRegisterPage()

    const allButtons = screen.getAllByRole('button')
    const formateurButton = allButtons.find(btn => btn.querySelector('p')?.textContent === 'Formateur')
    expect(formateurButton).toBeDefined()
    await userEvent.click(formateurButton!)

    await waitFor(() => {
      expect(screen.getByText('Teacher Registration Page')).toBeDefined()
    })
  })
})
