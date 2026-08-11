/**
 * useFinancialProfile — profil financier d'un titulaire et ses archives.
 *
 * Extrait de `FinancialProfilePage` le 2026-08-11, quand le profil financier est
 * devenu un **onglet de la fiche de profil** en plus de rester une page à part
 * entière (`/finance`, `/finance/:ownerId`). Deux écrans, une seule mécanique :
 * une copie aurait divergé au premier ajustement.
 *
 * Appartenance de l'état (règle du 2026-08-10) : le hook détient les données
 * affichées et y fait entrer **la réponse du serveur**, jamais le corps envoyé.
 * `PATCH /financial-profiles/:ownerId` renvoie le profil à jour : on l'affiche
 * tel quel, sans relecture.
 *
 * Routes consommées (`docs/routes.md`, finance-credit-service) :
 *   GET   /finance/financial-profiles/:ownerId
 *   PATCH /finance/financial-profiles/:ownerId
 *   GET   /finance/financial-archives/:ownerId
 *   POST  /finance/payments
 */

import { useCallback, useEffect, useState } from 'react'
import {
  fetchFinancialArchives,
  fetchFinancialProfile,
  initiatePayment,
  updateFinancialProfile,
  type FinancialArchiveItem,
  type FinancialProfile,
  type PaymentMethod,
} from '../../api/finance'

export interface UseFinancialProfileResult {
  financialProfile: FinancialProfile | null
  financialArchives: FinancialArchiveItem[]
  isLoadingProfile: boolean
  isLoadingArchives: boolean
  loadError: string | null

  isSavingPaymentMethod: boolean
  savePaymentMethodError: string | null
  savePaymentMethod: (
    paymentMethod: PaymentMethod,
    paymentReference: string | undefined,
  ) => Promise<boolean>

  isSubmittingPayment: boolean
  paymentError: string | null
  paymentSuccessMessage: string | null
  payRegistration: (amountCents: number) => Promise<boolean>
}

export function useFinancialProfile(ownerId: string): UseFinancialProfileResult {
  const [financialProfile, setFinancialProfile] = useState<FinancialProfile | null>(null)
  const [financialArchives, setFinancialArchives] = useState<FinancialArchiveItem[]>([])
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoadingArchives, setIsLoadingArchives] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [isSavingPaymentMethod, setIsSavingPaymentMethod] = useState(false)
  const [savePaymentMethodError, setSavePaymentMethodError] = useState<string | null>(null)

  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [paymentError, setPaymentError] = useState<string | null>(null)
  const [paymentSuccessMessage, setPaymentSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!ownerId) return

    let isCurrentOwner = true

    setIsLoadingProfile(true)
    setLoadError(null)
    fetchFinancialProfile(ownerId)
      .then((profile) => {
        if (isCurrentOwner) setFinancialProfile(profile)
      })
      .catch((error) => {
        if (!isCurrentOwner) return
        const statusCode = (error as { response?: { status?: number } })?.response?.status
        if (statusCode === 403) {
          setLoadError('Accès refusé.')
        } else if (statusCode === 404) {
          setLoadError('Profil financier introuvable.')
        } else {
          setLoadError('Impossible de charger le profil financier.')
        }
      })
      .finally(() => {
        if (isCurrentOwner) setIsLoadingProfile(false)
      })

    setIsLoadingArchives(true)
    fetchFinancialArchives(ownerId)
      .then((archives) => {
        if (isCurrentOwner) setFinancialArchives(archives)
      })
      .catch(() => {
        // Non bloquant : le profil reste lisible sans son historique.
      })
      .finally(() => {
        if (isCurrentOwner) setIsLoadingArchives(false)
      })

    return () => {
      isCurrentOwner = false
    }
  }, [ownerId])

  const savePaymentMethod = useCallback(
    async (paymentMethod: PaymentMethod, paymentReference: string | undefined) => {
      setIsSavingPaymentMethod(true)
      setSavePaymentMethodError(null)
      try {
        const updatedProfile = await updateFinancialProfile(ownerId, {
          paymentMethod,
          paymentReference,
        })
        // La réponse du serveur fait foi — jamais le corps envoyé.
        setFinancialProfile(updatedProfile)
        return true
      } catch {
        setSavePaymentMethodError('Impossible de mettre à jour le profil financier.')
        return false
      } finally {
        setIsSavingPaymentMethod(false)
      }
    },
    [ownerId],
  )

  const payRegistration = useCallback(
    async (amountCents: number) => {
      setIsSubmittingPayment(true)
      setPaymentError(null)
      setPaymentSuccessMessage(null)
      try {
        await initiatePayment({ paymentType: 'inscription', amountCents })
        setPaymentSuccessMessage(
          'Paiement effectué avec succès. Votre compte est maintenant membre.',
        )
        /**
         * Relecture assumée, et non un oubli de la règle « on affiche la
         * réponse » : `POST /payments` répond `{payment, invoice}`, jamais le
         * profil financier. Le passage en « membre » et la nouvelle ligne
         * d'archive sont calculés côté serveur et ne peuvent donc venir que
         * d'une lecture.
         */
        const [refreshedProfile, refreshedArchives] = await Promise.all([
          fetchFinancialProfile(ownerId),
          fetchFinancialArchives(ownerId),
        ])
        setFinancialProfile(refreshedProfile)
        setFinancialArchives(refreshedArchives)
        return true
      } catch (error: unknown) {
        const statusCode = (error as { response?: { status?: number } })?.response?.status
        setPaymentError(
          statusCode === 409
            ? 'Un paiement d\'inscription a déjà été effectué pour ce compte.'
            : 'Une erreur est survenue lors du paiement.',
        )
        return false
      } finally {
        setIsSubmittingPayment(false)
      }
    },
    [ownerId],
  )

  return {
    financialProfile,
    financialArchives,
    isLoadingProfile,
    isLoadingArchives,
    loadError,
    isSavingPaymentMethod,
    savePaymentMethodError,
    savePaymentMethod,
    isSubmittingPayment,
    paymentError,
    paymentSuccessMessage,
    payRegistration,
  }
}
