import * as fileType from 'file-type';

/**
 * `file-type` existe en deux API incompatibles selon la version resolue :
 * `fromBuffer` (CommonJS, <= v16, celle demandee par `package.json`) et
 * `fileTypeFromBuffer` (ESM, >= v17). npm ne peut pas dedupliquer cette
 * dependance avec celle, plus recente, requise en interne par
 * `@nestjs/common` (`node_modules/@nestjs/common/node_modules/file-type`) :
 * une resolution TypeScript/Node qui remonterait par erreur vers cette copie
 * imbriquee casserait un import nomme figé sur une seule des deux API. On
 * accepte donc explicitement les deux formes ici, pour rester correct quelle
 * que soit la copie effectivement resolue par l'arbre de dependances.
 */
const detectFileType: (buffer: Buffer) => Promise<{ mime: string } | undefined> = (() => {
  const module = fileType as unknown as {
    fromBuffer?: (buffer: Buffer) => Promise<{ mime: string } | undefined>;
    fileTypeFromBuffer?: (buffer: Buffer) => Promise<{ mime: string } | undefined>;
  };
  if (typeof module.fromBuffer === 'function') {
    return module.fromBuffer;
  }
  if (typeof module.fileTypeFromBuffer === 'function') {
    return module.fileTypeFromBuffer;
  }
  throw new Error(
    "file-type: aucune fonction de detection compatible trouvee (ni fromBuffer, ni fileTypeFromBuffer)",
  );
})();

/**
 * Liste blanche des types acceptés (arbitrage du 2026-08-26, point 5) —
 * jamais une liste noire. `application/x-cfb` est le format générique du
 * "Compound File Binary" de Microsoft (.doc/.xls/.ppt) : la signature binaire
 * ne permet pas de distinguer lequel des trois formats hérités il s'agit,
 * seule la structure interne (non inspectée ici) le permettrait — accepté
 * tel quel, la protection recherchée (refuser l'exécutable/le script) est
 * assurée sans cette distinction.
 */
export const ACCEPTED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/x-cfb', // .doc / .xls / .ppt (legacy OLE)
  'text/plain',
  'text/csv',
] as const;

export type AcceptedAttachmentMimeType = (typeof ACCEPTED_ATTACHMENT_MIME_TYPES)[number];

/** Type explicitement détecté et rejeté — jamais confondu avec du texte brut. */
export const SVG_MIME_TYPE = 'image/svg+xml';

/**
 * Détecte le type réel d'un fichier à partir de ses octets, jamais de son
 * extension ni du `Content-Type` déclaré par le client (tous deux sous son
 * contrôle) — même principe que la photo de profil (2026-08-10).
 *
 * `file-type` reconnaît une signature binaire pour PDF/images/DOCX-XLSX-PPTX/
 * OLE legacy, mais ne détecte ni le SVG (document XML, pas de signature
 * binaire fiable) ni le texte brut/CSV (aucune signature binaire n'existe
 * pour ces formats) : ces deux cas sont discriminés explicitement ci-dessous
 * plutôt que d'être absorbés silencieusement comme "texte" par défaut — un
 * SVG est un document XML exécutable, jamais accepté comme texte inoffensif.
 *
 * Retourne `null` si le format n'est ni reconnu ni assimilable à du texte
 * brut (fichier binaire non listé, à rejeter).
 */
export async function detectAttachmentMimeType(buffer: Buffer): Promise<string | null> {
  // Vérifié en pratique : `file-type` détecte lui-même une déclaration XML
  // générique (`<?xml ...?>`) comme `application/xml`, AVANT toute chance de
  // sniffer nous-mêmes le SVG — un SVG précédé de sa déclaration XML serait
  // donc mal classé si on faisait confiance à la détection binaire en
  // premier. La vérification explicite passe donc AVANT `fromBuffer`, pour
  // qu'un SVG (avec ou sans déclaration XML, avec ou sans détection binaire)
  // soit toujours identifié et refusé comme tel.
  const head = buffer.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<?xml') || head.startsWith('<svg')) {
    return SVG_MIME_TYPE;
  }

  const detected = await detectFileType(buffer);
  if (detected) {
    return detected.mime;
  }

  if (isPlainText(buffer)) {
    return 'text/plain';
  }

  return null;
}

/**
 * Heuristique de texte brut : refuse tout octet nul ou caractère de contrôle
 * (hors tabulation/retour à la ligne/retour chariot), signature d'un fichier
 * binaire, puis vérifie que le contenu est un UTF-8 valide.
 */
function isPlainText(buffer: Buffer): boolean {
  if (buffer.length === 0) return true;
  for (const byte of buffer) {
    if (byte === 0) return false;
    if (byte < 0x09) return false;
    if (byte > 0x0d && byte < 0x20) return false;
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    return true;
  } catch {
    return false;
  }
}
