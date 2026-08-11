/**
 * Libellés français des valeurs techniques de finance-credit-service.
 *
 * Règle de langue du projet (2026-08-09) : les clés d'API restent en anglais,
 * **tout ce que l'utilisateur lit est en français**, et la correspondance entre
 * les deux est portée en **un point unique**. Éparpillée, une même valeur finit
 * par porter deux libellés selon l'écran — ou pas de libellé du tout : le type
 * d'archive s'affichait jusqu'ici brut (`payment`, `ledger_entry`).
 */

import type {
  FinancialArchiveItemType,
  FinancialProfileType,
  PaymentMethod,
} from '../api/finance'

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cb: 'Carte bancaire',
  virement: 'Virement',
  paypal: 'PayPal',
}

export const PAYMENT_METHOD_OPTIONS: PaymentMethod[] = ['cb', 'virement', 'paypal']

/**
 * `limite` = compte créé mais inscription non payée ; `membre` = inscription
 * réglée (`docs/routes.md`, finance-credit-service).
 */
export const FINANCIAL_PROFILE_TYPE_LABELS: Record<FinancialProfileType, string> = {
  limite: 'Limité',
  membre: 'Membre',
}

export const FINANCIAL_ARCHIVE_ITEM_LABELS: Record<FinancialArchiveItemType, string> = {
  payment: 'Paiement',
  invoice: 'Facture',
  ledger_entry: 'Écriture',
}
