import { Link } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useMyTeacherValidationStatus } from '../../hooks/profile/useMyTeacherValidationStatus'
import { useTeacherValidationReapply } from '../../hooks/profile/useTeacherValidationReapply'
import { getOwnTeacherValidationMessage, isReapplyEligible } from '../../utils/teacherValidationLabels'

/**
 * AccountStatusBanners — bannières transverses de statut de compte, affichées
 * en tête de toutes les coquilles applicatives (`Layout`, `DashboardShell`).
 *
 * Extrait le 2026-08-13 après constat contre la pile réelle
 * (`teacher-own-validation-status.spec.ts`, rejoué sur https://claudevma.visioprof.fr) :
 * la bannière « dossier formateur en attente de validation » avait été posée
 * uniquement dans `Layout.tsx` (PR #108), mais **les pages de dashboard par
 * rôle** (`/dashboard/professeur`, etc.) ne montent jamais `Layout` — elles
 * utilisent `DashboardShell`, une seconde coquille quasi identique qui ne
 * réimplémentait que la bannière consentement. Le test unitaire
 * (`test/components/Layout.test.tsx`) rendait `Layout` isolément et passait
 * donc au vert sans jamais couvrir le chemin réellement emprunté par un
 * formateur qui se connecte — c'est le test e2e, joué contre la pile réelle,
 * qui a révélé l'écart.
 *
 * Un seul composant, monté par les deux coquilles, referme cet écart pour de
 * bon : il ne peut plus y avoir deux copies de cette logique à faire diverger
 * une seconde fois (règle de factorisation du projet).
 */
export function AccountStatusBanners() {
  const { isAuthenticated, user } = useAuth()

  const hasConsentWarning = isAuthenticated && user?.validationStatus === 'pending'

  // Statut du DOSSIER formateur (profile-service), distinct de user.validationStatus
  // ci-dessus (statut du COMPTE, identity-access-service). Voir teacherValidationLabels.ts.
  const {
    validationRecord: myTeacherValidationRecord,
    applyReapplyResult,
  } = useMyTeacherValidationStatus()
  const ownTeacherValidationMessage = getOwnTeacherValidationMessage(myTeacherValidationRecord)
  const canReapply = isReapplyEligible(myTeacherValidationRecord)

  const { reapply, isReapplying, reapplyError } = useTeacherValidationReapply(
    user?.id,
    applyReapplyResult,
  )

  return (
    <>
      {hasConsentWarning && (
        <div className="bg-yellow-50 border-b border-amber-200 py-2 px-6 text-center text-[var(--font-size-body-sm)] text-amber-800">
          Votre compte n'est pas encore activé.{' '}
          <Link to="/consents" className="underline font-semibold">
            Signer les consentements
          </Link>{' '}
          pour activer votre espace.
        </div>
      )}

      {ownTeacherValidationMessage && (
        <div
          className={
            ownTeacherValidationMessage.tone === 'rejected'
              ? 'bg-red-50 border-b border-red-200 py-2 px-6 text-center text-[var(--font-size-body-sm)] text-red-800'
              : 'bg-yellow-50 border-b border-amber-200 py-2 px-6 text-center text-[var(--font-size-body-sm)] text-amber-800'
          }
        >
          {ownTeacherValidationMessage.message}
          {canReapply && (
            <>
              {' '}
              <button
                type="button"
                onClick={reapply}
                disabled={isReapplying}
                className="underline font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isReapplying ? 'Envoi en cours…' : 'Relancer ma candidature'}
              </button>
            </>
          )}
          {reapplyError && <div className="mt-1 text-[var(--font-size-body-sm)]">{reapplyError}</div>}
        </div>
      )}
    </>
  )
}
