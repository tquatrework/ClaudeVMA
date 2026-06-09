import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Nav */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="text-xl font-bold text-indigo-600">
            VisioMath
          </Link>

          {isAuthenticated && (
            <nav className="flex items-center gap-6 text-sm text-gray-600">
              <Link to="/dashboard" className="hover:text-indigo-600">Tableau de bord</Link>
              <Link to="/calendar" className="hover:text-indigo-600">Calendrier</Link>
              <Link to="/messages" className="hover:text-indigo-600">Messages</Link>
              <Link to="/teacher-requests" className="hover:text-indigo-600">Demandes</Link>
              <span className="text-gray-400">|</span>
              <span className="font-medium text-gray-800">{user?.email}</span>
              <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                {user?.role}
              </span>
              <button
                onClick={handleLogout}
                className="text-red-500 hover:text-red-700"
              >
                Déconnexion
              </button>
            </nav>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      <footer className="py-4 text-center text-xs text-gray-400">
        VisioMath © 2026
      </footer>
    </div>
  )
}
