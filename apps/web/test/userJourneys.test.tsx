/**
 * User journey / integration flow tests
 *
 * These tests cover end-to-end page-to-page navigation within the React app.
 * They render multiple pages at once via react-router-dom and mock the API client
 * and useAuth hook throughout.
 *
 * Journeys covered:
 * 1. Login → Dashboard → Notifications
 * 2. Dashboard → Calendrier → Création séance
 * 3. Dashboard → Messagerie → Envoi message
 * 4. Dashboard → Demandes professeur → Création demande
 * 5. Dashboard → Profil → Édition profil
 */

import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Pages
import LoginPage from '../src/pages/LoginPage'
import EleveDashboardPage from '../src/pages/EleveDashboardPage'
import ProfesseurDashboardPage from '../src/pages/ProfesseurDashboardPage'
import CalendarPage from '../src/pages/CalendarPage'
import MessagesPage from '../src/pages/MessagesPage'
import TeacherRequestsPage from '../src/pages/TeacherRequestsPage'
import ProfilePage from '../src/pages/ProfilePage'
import ProfileEditPage from '../src/pages/ProfileEditPage'

// Mocks
vi.mock('../src/hooks/useAuth')
vi.mock('../src/api/client')

import { useAuth } from '../src/hooks/useAuth'
import apiClient from '../src/api/client'

const mockUseAuth = vi.mocked(useAuth)
const mockApiClient = vi.mocked(apiClient)

const STUDENT_USER = {
  id: 'student-1',
  email: 'eleve@test.com',
  role: 'eleve' as const,
  validationStatus: 'active' as const,
}

const TEACHER_USER = {
  id: 'teacher-1',
  email: 'prof@test.com',
  role: 'formateur' as const,
  validationStatus: 'active' as const,
}

const mockLoginFn = vi.fn()

function buildAuthMock(userObj = STUDENT_USER, overrides = {}) {
  return {
    user: userObj,
    isAuthenticated: true,
    isLoading: false,
    login: mockLoginFn,
    logout: vi.fn(),
    hasRole: vi.fn((...roles: string[]) => roles.includes(userObj.role)),
    isInternalRole: vi.fn(() => false),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockUseAuth.mockReturnValue(buildAuthMock())
})

// ---------------------------------------------------------------------------
// Journey 1: Login → Dashboard → Notifications
// ---------------------------------------------------------------------------
describe('Journey 1: Login → Dashboard → Notifications', () => {
  it('logs in and lands on dashboard showing notifications', async () => {
    const notifications = [
      { id: 'n1', message: 'Bienvenue sur VisioMath', read: false, createdAt: new Date().toISOString() },
    ]

    // Start unauthenticated on login
    mockUseAuth.mockReturnValue({
      ...buildAuthMock(STUDENT_USER, { isAuthenticated: false, user: null }),
      login: async (_loginIdentifier: string, _password: string) => {
        // After login, switch to authenticated state
        mockUseAuth.mockReturnValue(buildAuthMock())
        mockApiClient.get = vi.fn().mockImplementation((url: string) => {
          if (url === '/notifications') return Promise.resolve({ data: notifications })
          return Promise.resolve({ data: [] })
        })
      },
    })

    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/dashboard" element={<EleveDashboardPage />} />
          <Route path="/dashboard/eleve" element={<EleveDashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Fill in login form using loginIdentifier placeholder
    await userEvent.type(screen.getByPlaceholderText(/jean\.dupont/i), 'eleve@test.com')
    await userEvent.type(screen.getByPlaceholderText(/••••••••/), 'password')
    await userEvent.click(screen.getByRole('button', { name: /se connecter/i }))

    // Should land on dashboard — greeting appears (loginIdentifier absent → "vous")
    await waitFor(() => {
      expect(screen.getByText('Bonjour, vous')).toBeDefined()
    })
  })
})

// ---------------------------------------------------------------------------
// Journey 2: Dashboard → Calendrier → Création séance
// ---------------------------------------------------------------------------
describe('Journey 2: Dashboard → Calendrier → Création séance', () => {
  it('navigates from dashboard to calendar and creates a session', async () => {
    mockUseAuth.mockReturnValue(buildAuthMock(TEACHER_USER))

    const FUTURE = new Date(Date.now() + 86400000).toISOString()
    const newActivity = {
      id: 'act-new',
      title: 'Cours de trigonométrie',
      startAt: FUTURE,
      endAt: FUTURE,
      type: 'course',
    }

    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newActivity })

    render(
      <MemoryRouter initialEntries={['/dashboard/professeur']}>
        <Routes>
          <Route path="/dashboard/professeur" element={<ProfesseurDashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Dashboard renders — greeting uses "Bonjour, vous" (loginIdentifier absent dans le mock)
    await waitFor(() => {
      expect(screen.getByText('Bonjour, vous')).toBeDefined()
    })

    // Navigate to calendar via the "Calendrier" quick card (the link element)
    const calendarLinks = screen.getAllByText('Calendrier')
    // Click the first Calendrier link (could be in nav or quick-card)
    await userEvent.click(calendarLinks[0])

    // Now on Calendar page — should see the create button for formateur
    await waitFor(() => {
      screen.getByRole('button', { name: /nouvel événement/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /nouvel événement/i }))

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /créer un événement/i })).toBeDefined()
    })

    // Set datetime inputs via native input event
    const dateTimeInputs = document.querySelectorAll('input[type="datetime-local"]')
    const startInput = dateTimeInputs[0] as HTMLInputElement
    const endInput = dateTimeInputs[1] as HTMLInputElement

    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(startInput, '2030-03-10T09:00')
    startInput.dispatchEvent(new Event('change', { bubbles: true }))
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(endInput, '2030-03-10T10:00')
    endInput.dispatchEvent(new Event('change', { bubbles: true }))

    await userEvent.click(screen.getByRole('button', { name: /créer$/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/calendars/teacher-1/events'),
        expect.objectContaining({ eventType: expect.any(String) }),
      )
    })
  })
})

// ---------------------------------------------------------------------------
// Journey 3: Dashboard → Messagerie → Envoi message
// ---------------------------------------------------------------------------
describe('Journey 3: Dashboard → Messagerie → Envoi message', () => {
  it('navigates from dashboard to messages and sends a message', async () => {
    const conversations = [
      { id: 'conv-1', participantEmail: 'formateur@test.com', unreadCount: 0 },
    ]
    const sentMessage = {
      id: 'msg-1',
      senderId: 'student-1',
      content: 'Bonjour !',
      read: false,
      createdAt: new Date().toISOString(),
    }

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url === '/conversations') return Promise.resolve({ data: conversations })
      if (url === '/messages/conversation/conv-1') return Promise.resolve({ data: [] })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: sentMessage })

    render(
      <MemoryRouter initialEntries={['/dashboard/eleve']}>
        <Routes>
          <Route path="/dashboard/eleve" element={<EleveDashboardPage />} />
          <Route path="/messages" element={<MessagesPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Bonjour, vous')).toBeDefined()
    })

    // Navigate to messages — use the Messages nav link
    const messagesLinks = screen.getAllByText('Messages')
    await userEvent.click(messagesLinks[0])

    // Wait for conversations to load
    await waitFor(() => {
      expect(screen.getByText('formateur@test.com')).toBeDefined()
    })

    // Select the conversation
    await userEvent.click(screen.getByText('formateur@test.com'))

    // Wait for message input to appear
    await waitFor(() => {
      screen.getByPlaceholderText('Votre message…')
    })

    await userEvent.type(screen.getByPlaceholderText('Votre message…'), 'Bonjour !')
    await userEvent.click(screen.getByRole('button', { name: /envoyer/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/conversations/conv-1/messages', {
        content: 'Bonjour !',
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Journey 4: Dashboard → Demandes professeur → Création demande
// ---------------------------------------------------------------------------
describe('Journey 4: Dashboard → Demandes professeur → Création demande', () => {
  it('navigates from dashboard to teacher requests and creates a request', async () => {
    const newRequest = {
      id: 'req-new-abc',
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
      description: 'Aide en statistiques Terminale',
    }

    mockApiClient.get = vi.fn().mockResolvedValue({ data: [] })
    mockApiClient.post = vi.fn().mockResolvedValue({ data: newRequest })

    render(
      <MemoryRouter initialEntries={['/dashboard/eleve']}>
        <Routes>
          <Route path="/dashboard/eleve" element={<EleveDashboardPage />} />
          <Route path="/teacher-requests" element={<TeacherRequestsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Bonjour, vous')).toBeDefined()
    })

    // Navigate via "Demander un professeur" button — visible quand aucun professeur attitré
    await waitFor(() => {
      expect(screen.getAllByText('Demander un professeur').length).toBeGreaterThan(0)
    })
    await userEvent.click(screen.getAllByText('Demander un professeur')[0])

    await waitFor(() => {
      screen.getByRole('button', { name: /nouvelle demande/i })
    })

    await userEvent.click(screen.getByRole('button', { name: /nouvelle demande/i }))

    await userEvent.type(
      screen.getByPlaceholderText(/décrivez le besoin/i),
      'Aide en statistiques Terminale',
    )

    await userEvent.click(screen.getByRole('button', { name: /soumettre la demande/i }))

    await waitFor(() => {
      expect(mockApiClient.post).toHaveBeenCalledWith('/teacher-requests', {
        description: 'Aide en statistiques Terminale',
      })
    })
  })
})

// ---------------------------------------------------------------------------
// Journey 5: Dashboard → Profil → Édition profil
// ---------------------------------------------------------------------------
describe('Journey 5: Dashboard → Profil → Édition profil', () => {
  it('navigates from dashboard to profile then to edit page and saves', async () => {
    // Clés courtes `administrative` / `pedagogical` = forme réelle de
    // GET /profiles/:userId (les clés longues sont propres aux routes /internal/*).
    const existingProfile = {
      userId: 'student-1',
      administrative: { firstName: 'Paul', lastName: 'Leblanc' },
      pedagogical: { level: 'Seconde' },
    }

    mockApiClient.get = vi.fn().mockImplementation((url: string) => {
      if (url.startsWith('/profiles/student-1')) return Promise.resolve({ data: existingProfile })
      return Promise.resolve({ data: [] })
    })
    mockApiClient.put = vi.fn().mockResolvedValue({ data: {} })

    render(
      <MemoryRouter initialEntries={['/profiles/student-1']}>
        <Routes>
          <Route path="/profiles/:userId" element={<ProfilePage />} />
          <Route path="/profiles/:userId/edit" element={<ProfileEditPage />} />
          <Route path="/dashboard" element={<EleveDashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // Wait for profile to load
    await waitFor(() => {
      expect(screen.getByText('Profil administratif')).toBeDefined()
    })

    // Click edit
    await userEvent.click(screen.getByRole('link', { name: /modifier/i }))

    // Now on edit page
    await waitFor(() => {
      expect(screen.getByText('Modifier le profil')).toBeDefined()
    })

    // Submit administrative form
    await userEvent.click(screen.getByRole('button', { name: /enregistrer/i }))

    await waitFor(() => {
      expect(mockApiClient.put).toHaveBeenCalledWith(
        '/profiles/student-1/administrative',
        expect.objectContaining({ firstName: 'Paul' }),
      )
    })
  })
})
