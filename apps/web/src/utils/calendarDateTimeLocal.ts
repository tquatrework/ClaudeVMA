/**
 * calendarDateTimeLocal.ts — conversion entre une date ISO 8601 UTC et la valeur attendue par un
 * `<input type="datetime-local">` (`EventCreateFormModal`, correction du 2026-08-20, point D).
 *
 * Le projet traite systématiquement les heures de calendrier comme des valeurs **UTC directes**,
 * jamais reconverties dans le fuseau du navigateur (même convention que
 * `availabilitySlotApiMapping.ts`/`linkedCalendarBusyFree.ts` : « toujours construite et lue en
 * UTC »). Un `<input type="datetime-local">` ne porte lui-même aucun fuseau — la valeur saisie
 * est donc traitée directement comme l'heure UTC affichée ailleurs sur la grille (ex. « 09:00 »
 * signifie la même chose ici que sur une case de la grille), sans passer par les getters locaux du
 * navigateur.
 */

const DATE_TIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/

/** ISO 8601 UTC → valeur `datetime-local` (`"2026-08-24T09:00"`). Chaîne vide si illisible. */
export function toDateTimeLocalValue(isoDateTime: string): string {
  const parsed = new Date(isoDateTime)
  if (Number.isNaN(parsed.getTime())) return ''
  const year = parsed.getUTCFullYear()
  const month = (parsed.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = parsed.getUTCDate().toString().padStart(2, '0')
  const hours = parsed.getUTCHours().toString().padStart(2, '0')
  const minutes = parsed.getUTCMinutes().toString().padStart(2, '0')
  return `${year}-${month}-${day}T${hours}:${minutes}`
}

/** Valeur `datetime-local` → ISO 8601 UTC. `null` si la valeur ne respecte pas le format attendu. */
export function fromDateTimeLocalValue(value: string): string | null {
  if (!DATE_TIME_LOCAL_PATTERN.test(value)) return null
  return `${value}:00.000Z`
}
