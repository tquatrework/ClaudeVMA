import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import sharp from 'sharp';

/**
 * Formats reconnus par la détection sur les OCTETS RÉELS.
 *
 * `svg` et `heif` y figurent alors qu'ils sont refusés : les nommer permet de
 * répondre à l'utilisateur ce qui ne va pas au lieu d'un « format inconnu »
 * qui ne lui apprend rien.
 */
export type DetectedImageFormat =
  | 'jpeg'
  | 'png'
  | 'webp'
  | 'gif'
  | 'avif'
  | 'heif'
  | 'bmp'
  | 'tiff'
  | 'svg';

/** Formats acceptés en ENTRÉE. Tout le reste est refusé en 400. */
const ACCEPTED_INPUT_FORMATS: readonly DetectedImageFormat[] = [
  'jpeg',
  'png',
  'webp',
  'gif',
  'avif',
];

/** Côté maximal de l'image produite, en pixels. */
export const AVATAR_MAX_DIMENSION = 512;

/**
 * Plafond de pixels à l'ENTRÉE du décodeur (50 Mpx).
 *
 * Protège des « bombes de décompression » : un PNG de quelques kilo-octets
 * peut déclarer 50 000 × 50 000 pixels et faire réserver des gigaoctets au
 * décodage. Le plafond d'octets ne suffit donc pas — il porte sur le fichier
 * compressé, pas sur ce qu'il devient une fois décodé.
 */
const MAX_INPUT_PIXELS = 50_000_000;

/** Sortie unique : tout entre en n'importe quoi d'accepté, tout sort en WebP. */
export const AVATAR_OUTPUT_FORMAT = 'webp';
export const AVATAR_OUTPUT_CONTENT_TYPE = 'image/webp';
export const AVATAR_OUTPUT_EXTENSION = 'webp';

export interface TranscodedImage {
  bytes: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
  /** Format détecté à l'entrée, utile aux logs et aux tests. */
  sourceFormat: DetectedImageFormat;
}

/**
 * Détection de format et RÉ-ENCODAGE des images téléversées.
 *
 * Le principe tient en une phrase : on ne stocke JAMAIS les octets reçus.
 *
 * 1. Le type est déterminé sur les OCTETS RÉELS (nombres magiques). Ni
 *    l'extension du nom de fichier ni le `Content-Type` envoyé par le client
 *    ne sont consultés : ces deux-là sont sous le contrôle de l'appelant, donc
 *    ils ne prouvent rien. Un `.png` peut être un exécutable, un
 *    `Content-Type: image/jpeg` peut habiller du HTML.
 * 2. Les octets sont intégralement RÉ-ENCODÉS par sharp. Ce qui est stocké est
 *    la sortie de l'encodeur, pas l'entrée. Toute charge dissimulée dans le
 *    fichier d'origine (script en fin de JPEG, morceau PNG exotique,
 *    polyglotte GIF/HTML) disparaît par construction : elle n'est jamais
 *    recopiée.
 * 3. Le ré-encodage SUPPRIME AUSSI LES MÉTADONNÉES EXIF, et c'est un objectif
 *    en soi, pas un effet de bord. Une photo prise au téléphone porte
 *    couramment les coordonnées GPS du lieu de prise de vue — soit, pour une
 *    photo de profil, l'adresse du domicile d'un élève. Rien n'oblige la
 *    plateforme à la conserver, donc elle ne la conserve pas. `rotate()` est
 *    appelé AVANT que l'orientation EXIF ne soit perdue, faute de quoi les
 *    photos prises en mode portrait ressortiraient couchées.
 * 4. Le SVG est REFUSÉ. Ce n'est pas un format d'image au sens de ce service :
 *    c'est un document XML qui embarque scripts et références externes. sharp
 *    sait pourtant le lire (libRSVG est compilé dans le binaire) — raison de
 *    plus pour l'écarter explicitement avant de lui donner les octets.
 */
@Injectable()
export class ImageTranscoder {
  private readonly logger = new Logger(ImageTranscoder.name);

  /**
   * Détecte, valide, puis ré-encode en WebP borné à
   * {@link AVATAR_MAX_DIMENSION} pixels de côté.
   *
   * Toute entrée non exploitable ressort en `BadRequestException` avec un
   * message en français, lisible par l'utilisateur final (règle de langue du
   * 2026-08-09) : jamais un 500, jamais un succès silencieux.
   */
  async transcodeToAvatar(bytes: Buffer): Promise<TranscodedImage> {
    const sourceFormat = detectImageFormat(bytes);

    if (sourceFormat === null) {
      throw new BadRequestException(
        'Le fichier envoyé n’est pas une image reconnue. ' +
          'Formats acceptés : JPEG, PNG, WebP, GIF, AVIF.',
      );
    }
    if (sourceFormat === 'svg') {
      throw new BadRequestException(
        'Les fichiers SVG ne sont pas acceptés comme photo de profil : ' +
          'ce format peut contenir du code exécutable. ' +
          'Envoyez une image JPEG, PNG, WebP, GIF ou AVIF.',
      );
    }
    if (sourceFormat === 'heif') {
      throw new BadRequestException(
        'Les images HEIC/HEIF ne sont pas prises en charge. ' +
          'Enregistrez la photo en JPEG ou en PNG, puis renvoyez-la.',
      );
    }
    if (!ACCEPTED_INPUT_FORMATS.includes(sourceFormat)) {
      throw new BadRequestException(
        `Le format ${sourceFormat.toUpperCase()} n’est pas accepté comme photo de profil. ` +
          'Formats acceptés : JPEG, PNG, WebP, GIF, AVIF.',
      );
    }

    try {
      const { data, info } = await sharp(bytes, {
        limitInputPixels: MAX_INPUT_PIXELS,
        // Une seule image, jamais l'animation : un avatar animé de 300 images
        // multiplierait le coût de décodage sans rien apporter.
        animated: false,
      })
        // Applique l'orientation EXIF TANT QU'ELLE EXISTE ENCORE ; sans cet
        // appel, une photo portrait ressortirait couchée une fois l'EXIF
        // supprimé par le ré-encodage.
        .rotate()
        .resize({
          width: AVATAR_MAX_DIMENSION,
          height: AVATAR_MAX_DIMENSION,
          fit: 'cover',
          position: 'centre',
          // Une petite image reste petite : l'agrandir ne crée pas de détail,
          // seulement du poids et du flou.
          withoutEnlargement: true,
        })
        // Aucun appel à `withMetadata()` / `keepMetadata()` : c'est
        // précisément ce qui fait tomber EXIF, dont la géolocalisation.
        .webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });

      return {
        bytes: data,
        contentType: AVATAR_OUTPUT_CONTENT_TYPE,
        extension: AVATAR_OUTPUT_EXTENSION,
        width: info.width,
        height: info.height,
        sourceFormat,
      };
    } catch (error) {
      // Le format était bon d'après les nombres magiques, mais le contenu est
      // illisible : fichier tronqué, corrompu, ou en-tête maquillé. C'est une
      // erreur d'appelant, donc 400 — et le détail technique reste au log.
      this.logger.warn(
        `Ré-encodage impossible (format détecté=${sourceFormat}, ${bytes.length} octets) : ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
      throw new BadRequestException(
        'Le fichier envoyé est illisible ou endommagé, il n’a pas pu être traité comme une image.',
      );
    }
  }
}

/**
 * Format déduit des NOMBRES MAGIQUES en tête de fichier.
 *
 * `null` quand rien ne correspond. Fonction pure, testable seule, sans aucune
 * dépendance à sharp — c'est le premier verrou, il doit rester lisible.
 */
export function detectImageFormat(bytes: Buffer): DetectedImageFormat | null {
  if (bytes.length < 12) return null;

  // JPEG : FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }

  // GIF : "GIF87a" ou "GIF89a"
  const leadingSix = bytes.subarray(0, 6).toString('latin1');
  if (leadingSix === 'GIF87a' || leadingSix === 'GIF89a') return 'gif';

  // RIFF....WEBP
  if (
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }

  // BMP : "BM"
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';

  // TIFF : "II*\0" (little-endian) ou "MM\0*" (big-endian)
  const leadingFour = bytes.subarray(0, 4);
  if (
    leadingFour.equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
    leadingFour.equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
  ) {
    return 'tiff';
  }

  // Famille ISOBMFF : boîte "ftyp" à l'offset 4, marque sur 4 octets ensuite.
  if (bytes.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = bytes.subarray(8, 12).toString('latin1');
    if (brand === 'avif' || brand === 'avis') return 'avif';
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'mif1', 'msf1'].includes(brand)) {
      return 'heif';
    }
  }

  if (looksLikeSvg(bytes)) return 'svg';

  return null;
}

/**
 * Reconnaît un SVG malgré ses déguisements courants : BOM UTF-8, espaces ou
 * sauts de ligne en tête, déclaration XML, commentaire, ou balise `<svg>`
 * directe. La détection porte sur les 1024 premiers octets — au-delà, ce n'est
 * plus une en-tête.
 */
function looksLikeSvg(bytes: Buffer): boolean {
  let start = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) start = 3;

  const head = bytes.subarray(start, start + 1024).toString('utf8').trimStart().toLowerCase();
  if (head.startsWith('<svg')) return true;
  if (head.startsWith('<?xml') || head.startsWith('<!doctype svg') || head.startsWith('<!--')) {
    return head.includes('<svg');
  }
  return false;
}
