import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import apiClient from '../api/client'
import { useAuth } from '../hooks/useAuth'
import Layout from '../components/Layout'

interface Profile {
  userId: string
  administrativeProfile?: Record<string, unknown>
  pedagogicalProfile?: Record<string, unknown>
}

interface TeacherStudentRelation {
  teacherId: string
  studentId: string
  isPrincipalTeacher?: boolean
  createdAt?: string
}

interface InternalNote {
  id: string
  authorId: string
  content: string
  createdAt: string
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>()
  const { user, hasRole } = useAuth()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [teacherRelations, setTeacherRelations] = useState<TeacherStudentRelation[]>([])
  const [internalNotes, setInternalNotes] = useState<InternalNote[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Internal note form state
  const [newNoteContent, setNewNoteContent] = useState('')
  const [isAddingNote, setIsAddingNote] = useState(false)
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null)

  const canSeeInternalNotes = hasRole('responsable_pedagogique', 'administrateur_financier')
  const canSeeRelations = hasRole(
    'responsable_pedagogique',
    'animateur_pedagogique',
    'technicien_informatique',
    'administrateur_financier',
    'formateur',
  )
  const isViewingOwnProfile = user?.id === userId

  useEffect(() => {
    if (!userId) return
    setIsLoading(true)

    const profileRequest = apiClient
      .get<Profile>(`/profiles/${userId}`)
      .then(({ data }) => setProfile(data))
      .catch((err) => {
        const status = err?.response?.status
        if (status === 403) setError('Accès refusé')
        else if (status === 404) setError('Profil introuvable')
        else setError('Erreur lors du chargement du profil')
      })

    const relationsRequest = canSeeRelations
      ? apiClient
          .get<TeacherStudentRelation[]>(`/relations/teacher-student/${userId}`)
          .then(({ data }) => setTeacherRelations(Array.isArray(data) ? data : []))
          .catch(() => { /* non-blocking */ })
      : Promise.resolve()

    const notesRequest = canSeeInternalNotes
      ? apiClient
          .get<InternalNote[]>(`/profiles/${userId}/internal-notes`)
          .then(({ data }) => setInternalNotes(Array.isArray(data) ? data : []))
          .catch(() => { /* non-blocking */ })
      : Promise.resolve()

    Promise.allSettled([profileRequest, relationsRequest, notesRequest]).finally(() =>
      setIsLoading(false),
    )
  }, [userId, canSeeInternalNotes, canSeeRelations])

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || !newNoteContent.trim()) return
    setIsSavingNote(true)
    setNoteSaveError(null)
    try {
      const { data } = await apiClient.post<InternalNote>(`/profiles/${userId}/internal-notes`, {
        content: newNoteContent.trim(),
      })
      setInternalNotes((prev) => [data, ...prev])
      setNewNoteContent('')
      setIsAddingNote(false)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Erreur lors de l'ajout de la note"
      setNoteSaveError(message)
    } finally {
      setIsSavingNote(false)
    }
  }

  return (
    <Layout>
      <div className="max-w-2xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Fiche profil</h1>
          {(isViewingOwnProfile || hasRole('responsable_pedagogique', 'technicien_informatique')) && (
            <Link
              to={`/profiles/${userId}/edit`}
              className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Modifier
            </Link>
          )}
        </div>

        {isLoading && <p className="text-gray-400">Chargement…</p>}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        {profile && (
          <div className="space-y-6">
            {/* Administrative profile */}
            <ProfileSection
              title="Profil administratif"
              data={profile.administrativeProfile}
              emptyMessage="Aucune donnée administrative"
            />

            {/* Pedagogical profile */}
            <ProfileSection
              title="Profil pédagogique"
              data={profile.pedagogicalProfile}
              emptyMessage="Aucune donnée pédagogique"
            />

            {/* Teacher relations */}
            {canSeeRelations && (
              <div className="bg-white border border-gray-200 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Formateurs liés</h2>
                {teacherRelations.length === 0 ? (
                  <p className="text-gray-400 text-sm">Aucun formateur lié</p>
                ) : (
                  <ul className="space-y-2">
                    {teacherRelations.map((relation) => (
                      <li
                        key={relation.teacherId}
                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                      >
                        <Link
                          to={`/profiles/${relation.teacherId}`}
                          className="text-sm text-indigo-600 hover:underline font-mono"
                        >
                          {relation.teacherId.slice(0, 12)}…
                        </Link>
                        {relation.isPrincipalTeacher && (
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            Professeur principal
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Internal notes (RP / admin financier only) */}
            {canSeeInternalNotes && (
              <div className="bg-white border border-amber-200 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-800">
                    Notes internes
                    <span className="ml-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                      Confidentiel
                    </span>
                  </h2>
                  {!isAddingNote && (
                    <button
                      onClick={() => setIsAddingNote(true)}
                      className="text-sm text-indigo-600 hover:underline"
                    >
                      Ajouter une note
                    </button>
                  )}
                </div>

                {noteSaveError && (
                  <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {noteSaveError}
                  </div>
                )}

                {isAddingNote && (
                  <form onSubmit={handleAddNote} className="mb-4 space-y-3">
                    <textarea
                      required
                      value={newNoteContent}
                      onChange={(e) => setNewNoteContent(e.target.value)}
                      placeholder="Note interne (invisible pour l'élève, le parent et le formateur)…"
                      rows={3}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
                    />
                    <div className="flex gap-3">
                      <button
                        type="submit"
                        disabled={isSavingNote || !newNoteContent.trim()}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {isSavingNote ? 'Ajout…' : 'Ajouter'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAddingNote(false)
                          setNewNoteContent('')
                        }}
                        className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200"
                      >
                        Annuler
                      </button>
                    </div>
                  </form>
                )}

                {internalNotes.length === 0 && !isAddingNote ? (
                  <p className="text-gray-400 text-sm">Aucune note interne</p>
                ) : (
                  <ul className="space-y-3">
                    {internalNotes.map((note) => (
                      <li
                        key={note.id}
                        className="p-3 bg-amber-50 border border-amber-100 rounded-lg"
                      >
                        <p className="text-sm text-gray-800 whitespace-pre-wrap">{note.content}</p>
                        <p className="text-xs text-gray-400 mt-2">
                          {new Date(note.createdAt).toLocaleString('fr-FR')}
                          {note.authorId && ` · par ${note.authorId.slice(0, 8)}…`}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}

function ProfileSection({
  title,
  data,
  emptyMessage,
}: {
  title: string
  data?: Record<string, unknown>
  emptyMessage: string
}) {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-400 text-sm">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">{title}</h2>
      <dl className="space-y-3">
        {Object.entries(data)
          .filter(([, value]) => value !== null && value !== undefined && value !== '')
          .map(([key, value]) => (
            <div key={key} className="flex gap-4">
              <dt className="text-sm font-medium text-gray-500 w-36 shrink-0 capitalize">
                {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </dt>
              <dd className="text-sm text-gray-800 flex-1">
                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
              </dd>
            </div>
          ))}
      </dl>
    </div>
  )
}
