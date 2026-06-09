import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import apiClient from '../api/client'
import Layout from '../components/Layout'

interface Notification {
  id: string
  message: string
  read: boolean
  createdAt: string
}

export default function DashboardPage() {
  const { user, hasRole } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    apiClient
      .get<Notification[]>(`/notifications/user/${user.id}`)
      .then(({ data }) => setNotifications(data))
      .catch(() => { /* notifications non bloquantes */ })
      .finally(() => setIsLoading(false))
  }, [user])

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Bonjour{user ? `, ${user.email}` : ''} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Rôle : <span className="font-medium text-indigo-600">{user?.role}</span>
            {' · '}
            Statut : <span className="font-medium">{user?.validationStatus}</span>
          </p>
        </div>

        {/* Quick-access cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <DashboardCard to="/calendar" label="Calendrier" icon="📅" />
          <DashboardCard to="/messages" label="Messages" icon="💬" />
          <DashboardCard to="/teacher-requests" label="Demandes professeur" icon="🎓" />

          {/* Élève / parent */}
          {hasRole('eleve') && (
            <DashboardCard to={`/notebook/${user?.id}`} label="Mon carnet" icon="📓" />
          )}
          {hasRole('eleve', 'parent_financeur', 'formateur') && (
            <DashboardCard to={`/pedagogical-log/${user?.id}`} label="Cahier de texte" icon="📖" />
          )}

          {/* Internal roles */}
          {hasRole('responsable_pedagogique', 'animateur_pedagogique', 'technicien_informatique', 'administrateur_financier') && (
            <DashboardCard to="/admin/activity" label="Activité interne" icon="🔧" />
          )}
        </div>

        {/* Notifications */}
        <section>
          <h2 className="text-lg font-semibold text-gray-800 mb-3">
            Notifications {unreadCount > 0 && (
              <span className="ml-2 text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h2>

          {isLoading ? (
            <p className="text-gray-400 text-sm">Chargement…</p>
          ) : notifications.length === 0 ? (
            <p className="text-gray-400 text-sm">Aucune notification</p>
          ) : (
            <ul className="space-y-2">
              {notifications.slice(0, 5).map((n) => (
                <li
                  key={n.id}
                  className={`p-3 rounded-lg border text-sm ${
                    n.read ? 'bg-white border-gray-200 text-gray-600' : 'bg-indigo-50 border-indigo-200 text-gray-800 font-medium'
                  }`}
                >
                  {n.message}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Layout>
  )
}

function DashboardCard({ to, label, icon }: { to: string; label: string; icon: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center justify-center gap-2 p-6 bg-white border border-gray-200 rounded-2xl hover:border-indigo-300 hover:shadow-sm transition-all"
    >
      <span className="text-3xl">{icon}</span>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </Link>
  )
}
