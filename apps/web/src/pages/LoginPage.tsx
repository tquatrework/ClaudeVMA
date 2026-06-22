import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../context/AuthContext'

/** Map a user role to the most relevant landing page after login. */
function resolveRoleLandingPage(role: UserRole): string {
  switch (role) {
    case 'technicien_informatique':
      return '/admin/accounts'
    case 'responsable_pedagogique':
    case 'animateur_pedagogique':
    case 'administrateur_financier':
      return '/admin/activity'
    default:
      return '/dashboard'
  }
}

export default function LoginPage() {
  const { login, isLoading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const locationState = location.state as { from?: Location; message?: string } | null
  const redirectTarget = locationState?.from?.pathname ?? null
  const registrationMessage = locationState?.message ?? null

  const [loginIdentifier, setLoginIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    try {
      // login() stores the user in context; we read the role from localStorage
      // immediately after to determine the redirect destination.
      await login(loginIdentifier, password)
      if (redirectTarget) {
        navigate(redirectTarget, { replace: true })
      } else {
        const storedUser = localStorage.getItem('user')
        const userRole: UserRole | null = storedUser
          ? (JSON.parse(storedUser) as { role: UserRole }).role
          : null
        const landingPage = userRole ? resolveRoleLandingPage(userRole) : '/dashboard'
        navigate(landingPage, { replace: true })
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Identifiants invalides'
      setError(msg)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-indigo-600 mb-6">VisioMath — Connexion</h1>

        {registrationMessage && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            {registrationMessage}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Identifiant de connexion
            </label>
            <input
              type="text"
              required
              value={loginIdentifier}
              onChange={(e) => setLoginIdentifier(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="jean.dupont"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mot de passe
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="mt-4 text-sm text-gray-500 text-center">
          <Link to="/password-reset" className="text-indigo-600 hover:underline">
            Mot de passe oublié ?
          </Link>
        </p>

        <p className="mt-2 text-sm text-gray-500 text-center">
          <Link to="/recover-identifier" className="text-indigo-600 hover:underline">
            Identifiant oublié ?
          </Link>
        </p>

        <p className="mt-2 text-sm text-gray-500 text-center">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-indigo-600 hover:underline">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  )
}
