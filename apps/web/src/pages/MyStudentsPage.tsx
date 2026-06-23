import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'
import {
  fetchLinkedStudents,
  fetchStudentProfile,
  FinanceOwnerStudentLink,
} from '../api/relations'

interface LinkedStudentEntry {
  studentId: string
  displayName: string
}

export default function MyStudentsPage() {
  const { user } = useAuth()
  const [linkedStudents, setLinkedStudents] = useState<LinkedStudentEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!user) return

    fetchLinkedStudents(user.id)
      .then(async (links: FinanceOwnerStudentLink[]) => {
        const studentEntries = await Promise.all(
          links.map(async (link) => {
            try {
              const profile = await fetchStudentProfile(link.studentId)
              const firstName = profile.administrativeProfile?.firstName ?? ''
              const lastName = profile.administrativeProfile?.lastName ?? ''
              const displayName = [firstName, lastName].filter(Boolean).join(' ') || link.studentId
              return { studentId: link.studentId, displayName }
            } catch {
              return { studentId: link.studentId, displayName: link.studentId }
            }
          }),
        )
        setLinkedStudents(studentEntries)
      })
      .catch(() => setHasError(true))
      .finally(() => setIsLoading(false))
  }, [user])

  return (
    <Layout>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Mes élèves</h1>
        <p className="text-sm text-gray-500 mb-6">
          Liste des élèves rattachés à votre compte financeur.
        </p>

        {isLoading && <p className="text-sm text-gray-400">Chargement…</p>}

        {!isLoading && hasError && (
          <p className="text-sm text-red-600">
            Impossible de charger vos élèves. Veuillez réessayer.
          </p>
        )}

        {!isLoading && !hasError && linkedStudents.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
            <p className="text-gray-500 text-sm mb-4">Aucun élève rattaché.</p>
            <Link
              to="/parent-link-requests/new"
              className="inline-block bg-indigo-600 text-white text-sm px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Rattacher un élève
            </Link>
          </div>
        )}

        {!isLoading && !hasError && linkedStudents.length > 0 && (
          <ul className="space-y-3">
            {linkedStudents.map((student) => (
              <li
                key={student.studentId}
                className="bg-white border border-gray-200 rounded-xl p-5"
              >
                <p className="text-base font-semibold text-gray-800 mb-3">
                  {student.displayName}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to={`/profiles/${student.studentId}`}
                    className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Profil
                  </Link>
                  <Link
                    to={`/calendar?studentId=${student.studentId}`}
                    className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Calendrier
                  </Link>
                  <Link
                    to={`/pedagogical-log?studentId=${student.studentId}`}
                    className="text-sm text-indigo-600 border border-indigo-200 px-3 py-1 rounded-lg hover:bg-indigo-50 transition-colors"
                  >
                    Cahier de texte
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  )
}
