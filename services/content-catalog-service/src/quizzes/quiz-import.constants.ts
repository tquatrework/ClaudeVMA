/**
 * Plafond de taille d'un fichier d'import de Quizz (CSV ou Excel), en octets.
 *
 * Reste strictement SOUS le défaut non déclaré de `nginx-global` (1 Mio =
 * 1 048 576 octets, hors dépôt) — même raisonnement que la photo de profil
 * (docs/architecture.md, 2026-08-10, "Taille maximale d'un envoi de
 * fichier"). `api-gateway` déclare déjà 10 Mio (`client_max_body_size 10m`),
 * largement suffisant.
 *
 * Valeur par défaut : 900 000 octets (~900 Ko SI), proposée par l'arbitrage
 * du 2026-08-29 ("Import de Quizz depuis un tableur"). Un classeur Excel a un
 * overhead de conteneur ZIP non négligeable même pour peu de lignes ; cette
 * marge (~148 Ko sous le défaut nginx) absorbe cet overhead tout en restant
 * nettement sous 1 Mio.
 *
 * Réglable par variable d'environnement uniquement (pas de réglage TI en
 * base pour cette fonctionnalité, contrairement à l'avatar ou aux pièces
 * jointes du cahier de texte) : le contrat de ce chantier ne demande pas de
 * réglage dynamique, et la simplicité de code est une consigne explicite du
 * chantier Quizz (docs/architecture.md, 2026-08-28).
 */
const DEFAULT_QUIZ_IMPORT_MAX_FILE_SIZE_BYTES = 900_000;

function resolveMaxFileSizeBytes(): number {
  const raw = process.env.QUIZ_IMPORT_MAX_FILE_SIZE_BYTES;
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_QUIZ_IMPORT_MAX_FILE_SIZE_BYTES;
}

export const QUIZ_IMPORT_MAX_FILE_SIZE_BYTES = resolveMaxFileSizeBytes();
