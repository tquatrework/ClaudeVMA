import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../src/api/calendar')
import { acceptEventInvitation, declineEventInvitation } from '../../../src/api/calendar'

import InvitationBanner from '../../../src/components/calendar/InvitationBanner'
import type { CalendarEvent, InviteeStatus } from '../../../src/components/calendar/calendarTypes'

const mockAcceptEventInvitation = vi.mocked(acceptEventInvitation)
const mockDeclineEventInvitation = vi.mocked(declineEventInvitation)

interface InvitationEntry {
  event: CalendarEvent
  status: InviteeStatus
}

const FUTURE_ISO = new Date(Date.now() + 86400000).toISOString()
const FUTURE_ISO_END = new Date(Date.now() + 90000000).toISOString()

const pendingInvitation: InvitationEntry = {
  event: {
    id: 'evt-invite-1',
    title: 'Réunion pédagogique',
    startAt: FUTURE_ISO,
    endAt: FUTURE_ISO_END,
    eventType: 'invitation',
  },
  status: 'pending',
}

const acceptedInvitation: InvitationEntry = {
  event: {
    id: 'evt-invite-2',
    title: 'Cours déjà accepté',
    startAt: FUTURE_ISO,
    endAt: FUTURE_ISO_END,
    eventType: 'invitation',
  },
  status: 'accepted',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('InvitationBanner', () => {
  it("n'affiche rien quand il n'y a pas d'invitations pending", () => {
    const { container } = render(
      <InvitationBanner
        invitations={[acceptedInvitation]}
        userId="user-1"
        onStatusChange={vi.fn()}
      />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('affiche les invitations pending avec les boutons Accepter et Refuser', () => {
    render(
      <InvitationBanner
        invitations={[pendingInvitation]}
        userId="user-1"
        onStatusChange={vi.fn()}
      />,
    )

    expect(screen.getByText('Invitations en attente (1)')).toBeDefined()
    expect(screen.getByText('Réunion pédagogique')).toBeDefined()
    expect(screen.getByRole('button', { name: /accepter/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /refuser/i })).toBeDefined()
  })

  it('appelle POST /events/:id/invitees/:userId/accept et onStatusChange lors du clic Accepter', async () => {
    const handleStatusChange = vi.fn()
    mockAcceptEventInvitation.mockResolvedValue(undefined)

    render(
      <InvitationBanner
        invitations={[pendingInvitation]}
        userId="user-42"
        onStatusChange={handleStatusChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /accepter/i }))

    await waitFor(() => {
      expect(mockAcceptEventInvitation).toHaveBeenCalledWith('evt-invite-1', 'user-42')
      expect(handleStatusChange).toHaveBeenCalledWith('evt-invite-1', 'accepted')
    })
  })

  it('appelle POST /events/:id/invitees/:userId/decline et onStatusChange lors du clic Refuser', async () => {
    const handleStatusChange = vi.fn()
    mockDeclineEventInvitation.mockResolvedValue(undefined)

    render(
      <InvitationBanner
        invitations={[pendingInvitation]}
        userId="user-42"
        onStatusChange={handleStatusChange}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: /refuser/i }))

    await waitFor(() => {
      expect(mockDeclineEventInvitation).toHaveBeenCalledWith('evt-invite-1', 'user-42')
      expect(handleStatusChange).toHaveBeenCalledWith('evt-invite-1', 'declined')
    })
  })
})
