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

/**
 * Formate une date en forme locale courte sans heure.
 * Ex : "03/07/2026"
 */
export function formatLocalDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR')
}

/**
 * Formate une date en toutes lettres, sans heure.
 * Ex : "3 juillet 2026"
 *
 * Employée par les listes de liens de financement (« Depuis le … »), où la même
 * expression était recopiée dans les deux sections symétriques.
 */
export function formatLongDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Formate une date-heure complète en locale longue.
 * Ex : "3 juil. 2026 à 14:02"
 */
export function formatLocalDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR')
}

// ─── Date calendaire ISO (YYYY-MM-DD) ─────────────────────────────────────────

const ISO_CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Une chaîne est-elle une date calendaire ISO **stricte** (`YYYY-MM-DD`) et
 * réellement existante ?
 *
 * Deux écrans en dépendent : l'inscription élève (`birthDate` de
 * `POST /accounts/students`) et le profil administratif. Le serveur valide la
 * forme *et* l'existence : `2008-02-30` comme `2008-13-01` renvoient `400`, tout
 * comme un datetime complet (`2008-02-29T00:00:00.000Z`) ou un format localisé
 * (`29/02/2008`). On refuse donc ici avant d'émettre la requête, pour afficher un
 * message en français plutôt qu'un `400` opaque.
 */
export function isStrictIsoCalendarDate(value: string): boolean {
  const matched = ISO_CALENDAR_DATE_PATTERN.exec(value)
  if (!matched) return false

  const [, yearPart, monthPart, dayPart] = matched
  const year = Number(yearPart)
  const month = Number(monthPart)
  const day = Number(dayPart)

  if (month < 1 || month > 12 || day < 1) return false

  // `Date.UTC` normalise silencieusement un jour hors limites (31 avril → 1er mai) :
  // on compare donc les composants pour détecter la date inexistante.
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  )
}

/**
 * Affiche une date calendaire ISO au format français `JJ/MM/AAAA`.
 * Renvoie la valeur d'origine si elle n'est pas une date ISO exploitable, pour
 * ne jamais afficher « Invalid Date ».
 */
export function formatIsoCalendarDate(value: string): string {
  if (!isStrictIsoCalendarDate(value)) return value
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}
