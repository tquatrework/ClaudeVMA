import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated, hasRole } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const isActivePath = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`)

  const navLinkClass = (path: string) =>
    `hover:text-indigo-600 transition-colors ${
      isActivePath(path) ? 'text-indigo-600 font-semibold' : 'text-gray-600'
    }`

  const hasConsentWarning =
    isAuthenticated && user?.validationStatus === 'pending'

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Consent warning banner */}
      {hasConsentWarning && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center text-sm text-yellow-800">
          Votre compte n'est pas encore activé.{' '}
          <Link to="/consents" className="underline font-medium hover:text-yellow-900">
            Signer les consentements
          </Link>{' '}
          pour activer votre espace.
        </div>
      )}

      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/dashboard" className="text-xl font-bold text-indigo-600 shrink-0">
            VisioMath
          </Link>

          {/* Desktop nav */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-5 text-sm">
              <Link to="/dashboard" className={navLinkClass('/dashboard')}>
                Tableau de bord
              </Link>
              <Link to="/calendar" className={navLinkClass('/calendar')}>
                Calendrier
              </Link>
              <Link to="/activities" className={navLinkClass('/activities')}>
                Activités
              </Link>
              <Link to="/messages" className={navLinkClass('/messages')}>
                Messages
              </Link>
              <Link to="/teacher-requests" className={navLinkClass('/teacher-requests')}>
                Demandes
              </Link>

              {hasRole('eleve') && user && (
                <Link to={`/notebook/${user.id}`} className={navLinkClass(`/notebook/${user.id}`)}>
                  Mon carnet
                </Link>
              )}

              <Link to="/memos" className={navLinkClass('/memos')}>
                Mémos
              </Link>

              {hasRole('technicien_informatique', 'responsable_pedagogique') && (
                <Link to="/incidents" className={navLinkClass('/incidents')}>
                  Incidents
                </Link>
              )}

              {hasRole(
                'responsable_pedagogique',
                'animateur_pedagogique',
                'technicien_informatique',
                'administrateur_financier',
              ) && (
                <Link to="/admin/activity" className={navLinkClass('/admin/activity')}>
                  Admin
                </Link>
              )}

              {hasRole('responsable_pedagogique', 'technicien_informatique') && (
                <Link to="/admin/accounts" className={navLinkClass('/admin/accounts')}>
                  Comptes
                </Link>
              )}

              {hasRole(
                'responsable_pedagogique',
                'technicien_informatique',
                'administrateur_financier',
              ) && (
                <Link to="/delegations" className={navLinkClass('/delegations')}>
                  Délégations
                </Link>
              )}

              {hasRole('parent_financeur', 'administrateur_financier') && (
                <Link to="/finance" className={navLinkClass('/finance')}>
                  Finances
                </Link>
              )}

              {hasRole('formateur', 'administrateur_financier') && (
                <Link to="/teacher-payment-requests" className={navLinkClass('/teacher-payment-requests')}>
                  Paiements
                </Link>
              )}

              {(hasRole('eleve', 'parent_financeur', 'formateur') || hasRole('administrateur_financier')) && (
                <Link to="/legal" className={navLinkClass('/legal')}>
                  Documents légaux
                </Link>
              )}

              {!hasRole('technicien_informatique', 'administrateur_financier') && (
                <Link to="/archives" className={navLinkClass('/archives')}>
                  Archives
                </Link>
              )}

              {hasRole('administrateur_financier') && (
                <Link to="/admin/finance" className={navLinkClass('/admin/finance')}>
                  Espace AF
                </Link>
              )}

              <span className="text-gray-200">|</span>

              {/* User identity */}
              <Link
                to={user ? `/profiles/${user.id}` : '/dashboard'}
                className="flex items-center gap-2 hover:opacity-80 transition-opacity"
              >
                <span className="font-medium text-gray-800 text-xs">{user?.email}</span>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                  {user?.role}
                </span>
                {user?.validationStatus === 'pending' && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                    non activé
                  </span>
                )}
              </Link>

              <button
                onClick={handleLogout}
                className="text-sm text-red-500 hover:text-red-700 transition-colors"
              >
                Déconnexion
              </button>
            </nav>
          )}

          {/* Mobile menu button */}
          {isAuthenticated && (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-500 hover:text-gray-700"
              aria-label="Menu"
            >
              <span className="block w-5 h-0.5 bg-current mb-1"></span>
              <span className="block w-5 h-0.5 bg-current mb-1"></span>
              <span className="block w-5 h-0.5 bg-current"></span>
            </button>
          )}
        </div>

        {/* Mobile nav */}
        {isAuthenticated && isMobileMenuOpen && (
          <nav className="md:hidden bg-white border-t border-gray-100 px-4 py-3 space-y-2 text-sm">
            <MobileNavLink to="/dashboard" label="Tableau de bord" onClick={() => setIsMobileMenuOpen(false)} />
            <MobileNavLink to="/calendar" label="Calendrier" onClick={() => setIsMobileMenuOpen(false)} />
            <MobileNavLink to="/activities" label="Activités" onClick={() => setIsMobileMenuOpen(false)} />
            <MobileNavLink to="/messages" label="Messages" onClick={() => setIsMobileMenuOpen(false)} />
            <MobileNavLink to="/teacher-requests" label="Demandes prof." onClick={() => setIsMobileMenuOpen(false)} />
            <MobileNavLink to="/memos" label="Mémos" onClick={() => setIsMobileMenuOpen(false)} />
            {hasRole('eleve') && user && (
              <MobileNavLink to={`/notebook/${user.id}`} label="Mon carnet" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            {hasRole('technicien_informatique', 'responsable_pedagogique') && (
              <MobileNavLink to="/incidents" label="Incidents" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            {hasRole('responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier') && (
              <MobileNavLink to="/admin/activity" label="Admin" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            {hasRole('responsable_pedagogique', 'technicien_informatique') && (
              <MobileNavLink to="/admin/accounts" label="Comptes" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            {hasRole('responsable_pedagogique', 'technicien_informatique', 'administrateur_financier') && (
              <MobileNavLink to="/delegations" label="Délégations" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            {hasRole('parent_financeur', 'administrateur_financier') && (
              <MobileNavLink to="/finance" label="Finances" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            {hasRole('formateur', 'administrateur_financier') && (
              <MobileNavLink to="/teacher-payment-requests" label="Paiements" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            {(hasRole('eleve', 'parent_financeur', 'formateur') || hasRole('administrateur_financier')) && (
              <MobileNavLink to="/legal" label="Documents légaux" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            {!hasRole('technicien_informatique', 'administrateur_financier') && (
              <MobileNavLink to="/archives" label="Archives" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            {hasRole('administrateur_financier') && (
              <MobileNavLink to="/admin/finance" label="Espace AF" onClick={() => setIsMobileMenuOpen(false)} />
            )}
            <div className="pt-2 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-1">{user?.email}</p>
              <button
                onClick={handleLogout}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Déconnexion
              </button>
            </div>
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="py-4 text-center text-xs text-gray-400 border-t border-gray-100">
        VisioMath © 2026
      </footer>
    </div>
  )
}

function MobileNavLink({
  to,
  label,
  onClick,
}: {
  to: string
  label: string
  onClick: () => void
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block py-2 text-gray-700 hover:text-indigo-600 transition-colors"
    >
      {label}
    </Link>
  )
}
