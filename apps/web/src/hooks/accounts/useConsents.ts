import { useCallback, useMemo, useState } from 'react'
import { fetchConsents, grantConsent, withdrawConsent } from '../../api/accounts'
import type { ConsentState, ConsentType } from '../../types/accounts'
import { useAsyncData } from '../useAsyncData'
import {
  buildGrantSuccessMessage,
  buildWithdrawalSuccessMessage,
  getConsentGrantErrorMessage,
  getConsentWithdrawalErrorMessage,
  hasGrantedAllMandatoryConsents,
  sortConsentsForDisplay,
} from '../../utils/consents'

export interface UseConsentsResult {
  /** État courant des consentements, obligatoires d'abord. */
  consents: ConsentState[]
  /** Premier chargement uniquement — un rechargement après action ne vide pas l'écran. */
  isLoading: boolean
  loadError: string | null
  /** Donne ou redonne un consentement (`POST /consents`). */
  grant: (consentType: ConsentType) => Promise<boolean>
  /** Retire un consentement optionnel (`POST /consents/:consentType/withdraw`). */
  withdraw: (consentType: ConsentType) => Promise<boolean>
  isSaving: boolean
  actionError: string | null
  actionSuccessMessage: string | null
  dismissActionFeedback: () => void
  /** Tous les consentements obligatoires sont-ils accordés ? */
  hasGrantedAllMandatory: boolean
}

/**
 * useConsents — état courant des consentements de l'utilisateur connecté, et actions
 * d'octroi / de retrait.
 *
 * Après chaque action réussie, la liste est **rechargée depuis le serveur** plutôt que
 * mise à jour de façon optimiste : le serveur est seul à connaître l'état résultant
 * (`status`, `grantedAt`, `withdrawnAt`), et un écran de consentements qui devine son
 * contenu est exactement le mensonge que cette page doit éviter. Les données déjà
 * chargées restent affichées pendant le rechargement, `isLoading` ne repassant à `true`
 * que pour le tout premier chargement.
 */
export function useConsents(): UseConsentsResult {
  const {
    data,
    isLoading,
    error: loadError,
    refetch,
  } = useAsyncData(fetchConsents, [], {
    fallbackErrorMessage: 'Impossible de charger les consentements.',
  })

  const [isSaving, setIsSaving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)

  const consents = useMemo(() => sortConsentsForDisplay(data ?? []), [data])
  const hasGrantedAllMandatory = useMemo(() => hasGrantedAllMandatoryConsents(consents), [consents])

  const dismissActionFeedback = useCallback(() => {
    setActionError(null)
    setActionSuccessMessage(null)
  }, [])

  /**
   * Exécute une action de consentement en centralisant le cycle
   * remise à zéro du retour → verrou anti-double-soumission → rechargement → traduction
   * de l'erreur. Aucun échec n'est avalé : il devient toujours un message à l'écran.
   */
  const runConsentAction = useCallback(
    async (
      performAction: () => Promise<unknown>,
      buildSuccessMessage: () => string,
      translateError: (error: unknown) => string,
    ): Promise<boolean> => {
      setActionError(null)
      setActionSuccessMessage(null)
      setIsSaving(true)
      try {
        await performAction()
        setActionSuccessMessage(buildSuccessMessage())
        refetch()
        return true
      } catch (caughtError: unknown) {
        setActionError(translateError(caughtError))
        return false
      } finally {
        setIsSaving(false)
      }
    },
    [refetch],
  )

  const grant = useCallback(
    (consentType: ConsentType) =>
      runConsentAction(
        () => grantConsent(consentType),
        () => buildGrantSuccessMessage(consentType),
        getConsentGrantErrorMessage,
      ),
    [runConsentAction],
  )

  const withdraw = useCallback(
    (consentType: ConsentType) =>
      runConsentAction(
        () => withdrawConsent(consentType),
        () => buildWithdrawalSuccessMessage(consentType),
        getConsentWithdrawalErrorMessage,
      ),
    [runConsentAction],
  )

  return {
    consents,
    isLoading: isLoading && data === undefined,
    loadError,
    grant,
    withdraw,
    isSaving,
    actionError,
    actionSuccessMessage,
    dismissActionFeedback,
    hasGrantedAllMandatory,
  }
}
