/**
 * Utilitaires de formatage de dates — centralisés
 *
 * Ces fonctions étaient dupliquées dans EleveDashboardPage et ProfesseurDashboardPage.
 * Elles sont maintenant définies une seule fois ici.
 */

/**
 * Calcule le temps restant avant un événement et retourne un libellé lisible.
 * Ex : "dans 45 min", "dans 2h30", "en cours"
 */
export function formatCountdown(startAt: string): string {
  const diffMs = new Date(startAt).getTime() - Date.now()
  if (diffMs <= 0) return 'en cours'
  const diffMinutes = Math.floor(diffMs / 60000)
  if (diffMinutes < 60) return `dans ${diffMinutes} min`
  const diffHours = Math.floor(diffMinutes / 60)
  const remainingMinutes = diffMinutes % 60
  if (remainingMinutes === 0) return `dans ${diffHours}h`
  return `dans ${diffHours}h${String(remainingMinutes).padStart(2, '0')}`
}

/**
 * Formate une date d'événement en forme longue.
 * Ex : "lundi 3 juillet 14:00"
 */
export function formatEventDate(startAt: string): string {
  return new Date(startAt).toLocaleString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formate une date d'événement en forme courte.
 * Ex : "lun. 3 juil. 14:00"
 */
export function formatShortDate(startAt: string): string {
  return new Date(startAt).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Formate une date de notification / activité.
 * Ex : "3 juil. 14:02"
 */
export function formatActivityDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
