/**
 * Plafond de taille d'un fichier d'import d'Exercice (CSV ou Excel), en octets.
 *
 * Même convention que l'import de Quizz (`quiz-import.constants.ts`,
 * 2026-08-29) : reste strictement SOUS le défaut non déclaré de
 * `nginx-global` (1 Mio = 1 048 576 octets, hors dépôt) — même raisonnement
 * que la photo de profil (docs/architecture.md, 2026-08-10, "Taille maximale
 * d'un envoi de fichier"). `api-gateway` déclare déjà 10 Mio
 * (`client_max_body_size 10m`), largement suffisant.
 *
 * Valeur par défaut : 900 000 octets (~900 Ko SI), identique au plafond
 * retenu pour le Quizz. Un bloc Exercice peut théoriquement embarquer des
 * images en base64 (`type=image`) et consommer ce budget bien plus vite
 * qu'un Quizz texte — l'arbitrage du 2026-09-02 note explicitement que ce
 * cas est "peu praticable à remplir à la main dans un tableur" et réservé à
 * un usage scripté/généré ; la valeur par défaut n'est donc pas relevée par
 * anticipation, cohérent avec la règle du projet de ne pas construire pour
 * un besoin non confirmé. À relever via la variable d'environnement
 * ci-dessous si un usage réel avec images s'avère trop souvent bloqué.
 */
const DEFAULT_EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES = 900_000;

function resolveMaxFileSizeBytes(): number {
  const raw = process.env.EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES;
}

export const EXERCISE_IMPORT_MAX_FILE_SIZE_BYTES = resolveMaxFileSizeBytes();
