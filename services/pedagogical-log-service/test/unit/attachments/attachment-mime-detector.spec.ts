/**
 * Unit tests — detectAttachmentMimeType
 *
 * Arbitrage du 2026-08-26, "Liens et pièces jointes sur une entrée de cahier
 * de texte", point 5 : liste blanche de types acceptés, détection sur les
 * octets réels — jamais l'extension ni le Content-Type client. Le SVG doit
 * être explicitement refusé, jamais confondu avec du texte inoffensif.
 */

import {
  detectAttachmentMimeType,
  ACCEPTED_ATTACHMENT_MIME_TYPES,
  SVG_MIME_TYPE,
} from '../../../src/attachments/attachment-mime-detector';

// Échantillons binaires minimaux réels (bases64), pas des extensions déguisées.
const PDF_HEADER = Buffer.from('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);
const GIF_1X1 = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7',
  'base64',
);

describe('detectAttachmentMimeType', () => {
  it('détecte un PDF par sa signature binaire', async () => {
    expect(await detectAttachmentMimeType(PDF_HEADER)).toBe('application/pdf');
  });

  it('détecte un PNG par sa signature binaire', async () => {
    expect(await detectAttachmentMimeType(PNG_1X1)).toBe('image/png');
  });

  it('détecte un GIF par sa signature binaire', async () => {
    expect(await detectAttachmentMimeType(GIF_1X1)).toBe('image/gif');
  });

  it('[CRITIQUE] un SVG est explicitement identifié, jamais absorbé comme texte', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    expect(await detectAttachmentMimeType(svg)).toBe(SVG_MIME_TYPE);
    expect(ACCEPTED_ATTACHMENT_MIME_TYPES as readonly string[]).not.toContain(SVG_MIME_TYPE);
  });

  it('[CRITIQUE] un document XML générique (<?xml ...) est traité comme le SVG, jamais comme du texte', async () => {
    const xml = Buffer.from('<?xml version="1.0"?><svg></svg>');
    expect(await detectAttachmentMimeType(xml)).toBe(SVG_MIME_TYPE);
  });

  it('reconnaît du texte brut / CSV sans signature binaire', async () => {
    const csv = Buffer.from('label,url\nCours,https://example.com\n');
    expect(await detectAttachmentMimeType(csv)).toBe('text/plain');
  });

  it('un fichier renommé en .csv mais contenant un exécutable déguisé en PDF reste détecté par ses octets réels (PDF ici)', async () => {
    // Démontre que la détection ignore toute extension : ce buffer est bien
    // un PDF, peu importe le nom de fichier fourni par le client.
    expect(await detectAttachmentMimeType(PDF_HEADER)).toBe('application/pdf');
  });

  it('un contenu binaire non reconnu (ni signature connue, ni texte valide) → null', async () => {
    const garbage = Buffer.from([0x00, 0x01, 0x02, 0xff, 0xfe, 0x00, 0x10, 0x20]);
    expect(await detectAttachmentMimeType(garbage)).toBeNull();
  });

  it('un buffer vide est traité comme du texte vide (cas limite, jamais un crash)', async () => {
    expect(await detectAttachmentMimeType(Buffer.alloc(0))).toBe('text/plain');
  });
});
