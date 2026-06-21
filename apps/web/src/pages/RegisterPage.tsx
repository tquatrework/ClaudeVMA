import React from 'react'
import { Link, useNavigate } from 'react-router-dom'

/**
 * RegisterPage — Entry point for account creation.
 *
 * Routes users to the appropriate specialized wizard:
 * - Élève → /register/student (POST /accounts/students)
 * - Formateur → /register/teacher (POST /accounts/teachers)
 * - Parent/Financeur → /register/parent (POST /accounts/parents)
 */
export default function RegisterPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-md p-8">
        <h1 className="text-2xl font-bold text-indigo-600 mb-2">VisioMath — Créer un compte</h1>
        <p className="text-sm text-gray-500 mb-8">Choisissez votre profil pour commencer.</p>

        <div className="space-y-3">
          <button
            onClick={() => navigate('/register/student')}
            className="w-full flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left group"
          >
            <span className="text-3xl">🎓</span>
            <div>
              <p className="font-semibold text-gray-800 group-hover:text-indigo-700">Élève</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Accédez aux cours, au calendrier, au cahier de texte et à votre carnet personnel.
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/register/teacher')}
            className="w-full flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left group"
          >
            <span className="text-3xl">📚</span>
            <div>
              <p className="font-semibold text-gray-800 group-hover:text-indigo-700">Formateur</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Gérez vos élèves, vos cours, votre calendrier et votre suivi pédagogique.
                Validation par un Responsable Pédagogique requise.
              </p>
            </div>
          </button>

          <button
            onClick={() => navigate('/register/parent')}
            className="w-full flex items-start gap-4 p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-left group"
          >
            <span className="text-3xl">👨‍👩‍👧</span>
            <div>
              <p className="font-semibold text-gray-800 group-hover:text-indigo-700">Parent / Financeur</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Suivez la progression de vos élèves, gérez les paiements et consultez les archives.
              </p>
            </div>
          </button>
        </div>

        <p className="mt-6 text-sm text-gray-500 text-center">
          Déjà inscrit ?{' '}
          <Link to="/login" className="text-indigo-600 hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  )
}
