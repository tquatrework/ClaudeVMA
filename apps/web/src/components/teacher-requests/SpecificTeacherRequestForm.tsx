/**
 * SpecificTeacherRequestForm
 *
 * Formulaire de création d'une demande professeur spécifique.
 * Utilisé par élève et parent_financeur.
 * Appelle POST /api/v1/teacher-requests.
 */
import React, { useState } from 'react'
import apiClient from '../../api/client'

interface TeacherRequestPayload {
  subject: string
  level: string
  sector: string
  message?: string
  studentId?: string
}

interface TeacherRequestCreated {
  id: string
  status: string
  createdAt: string
  subject: string
  level: string
  sector: string
  message?: string
  studentId?: string
}

interface SpecificTeacherRequestFormProps {
  /** Pré-rempli si l'utilisateur est un parent soumettant pour un élève lié */
  defaultStudentId?: string
  /** Si true, affiche le champ ID élève */
  showStudentIdField?: boolean
  onSuccess: (createdRequest: TeacherRequestCreated) => void
  onCancel: () => void
}

export default function SpecificTeacherRequestForm({
  defaultStudentId = '',
  showStudentIdField = false,
  onSuccess,
  onCancel,
}: SpecificTeacherRequestFormProps) {
  const [subject, setSubject] = useState('')
  const [level, setLevel] = useState('')
  const [sector, setSector] = useState('')
  const [message, setMessage] = useState('')
  const [studentId, setStudentId] = useState(defaultStudentId)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isFormValid = subject.trim() !== '' && level.trim() !== '' && sector.trim() !== ''

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isFormValid) return

    setIsSubmitting(true)
    setErrorMessage(null)

    const payload: TeacherRequestPayload = {
      subject: subject.trim(),
      level: level.trim(),
      sector: sector.trim(),
    }
    if (message.trim()) payload.message = message.trim()
    if (studentId.trim()) payload.studentId = studentId.trim()

    try {
      const { data } = await apiClient.post<TeacherRequestCreated>('/teacher-requests', payload)
      onSuccess(data)
    } catch (error: unknown) {
      const apiMessage =
        (error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Erreur lors de la création de la demande'
      setErrorMessage(apiMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white border border-gray-200 rounded-xl p-6 space-y-5 shadow-sm"
    >
      <h2 className="text-base font-semibold text-gray-800">
        Nouvelle demande de professeur
      </h2>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center justify-between">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-red-400 hover:text-red-600 ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {showStudentIdField && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            ID de l'élève <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <input
            type="text"
            value={studentId}
            onChange={(event) => setStudentId(event.target.value)}
            placeholder="UUID de l'élève concerné"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Sujet / Matière <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="ex. Algèbre, Analyse, Probabilités…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Niveau scolaire <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          placeholder="ex. 3ème, Terminale, BTS, L1…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Filière <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={sector}
          onChange={(event) => setSector(event.target.value)}
          placeholder="ex. Générale, Technologique, Professionnelle, Supérieur…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Message <span className="text-gray-400 font-normal">(optionnel)</span>
        </label>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Précisez les objectifs, les difficultés rencontrées, les contraintes particulières…"
          rows={4}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
        />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting || !isFormValid}
          className="bg-indigo-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {isSubmitting ? 'Envoi…' : 'Soumettre la demande'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="bg-gray-100 text-gray-700 px-5 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors"
        >
          Annuler
        </button>
      </div>
    </form>
  )
}
