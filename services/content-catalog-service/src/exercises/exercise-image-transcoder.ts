import { BadRequestException, Injectable, Logger } from '@nestjs/common';
/**
 * `import * as sharp`, et non `import sharp from 'sharp'` — même remarque que
 * profile-service (src/media/image-transcoder.ts) : sharp publie ses types en
 * `export = sharp`, et ce service compile avec `esModuleInterop` par défaut de
 * NestJS (false) ; la forme namespace émet un `require()` direct, seule
 * correcte à l'exécution.
 */
import * as sharp from 'sharp';

export type DetectedImageFormat = 'jpeg' | 'png' | 'webp' | 'gif' | 'avif' | 'heif' | 'bmp' | 'tiff' | 'svg';

const ACCEPTED_INPUT_FORMATS: readonly DetectedImageFormat[] = ['jpeg', 'png', 'webp', 'gif', 'avif'];

/** Côté maximal de l'image produite, en pixels — une illustration d'énoncé, pas un avatar carré. */
export const EXERCISE_IMAGE_MAX_DIMENSION = 1600;

/** Plafond de pixels à l'entrée du décodeur (50 Mpx), même protection anti bombe de décompression que l'avatar. */
const MAX_INPUT_PIXELS = 50_000_000;

export const EXERCISE_IMAGE_OUTPUT_CONTENT_TYPE = 'image/webp';

export interface TranscodedExerciseImage {
  bytes: Buffer;
  contentType: string;
  width: number;
  height: number;
  sourceFormat: DetectedImageFormat;
}

/**
 * Détection de format et RÉ-ENCODAGE des images d'exercice — même principe
 * que la photo de profil (2026-08-10) : on ne stocke JAMAIS les octets reçus,
 * uniquement la sortie de l'encodeur. Le SVG est refusé (document XML
 * exécutable), les métadonnées EXIF disparaissent par construction (aucun
 * `withMetadata()`), et l'orientation est appliquée avant que l'EXIF ne soit
 * perdu.
 */
@Injectable()
export class ExerciseImageTranscoder {
  private readonly logger = new Logger(ExerciseImageTranscoder.name);

  async transcode(bytes: Buffer): Promise<TranscodedExerciseImage> {
    const sourceFormat = detectImageFormat(bytes);

    if (sourceFormat === null) {
      throw new BadRequestException(
        'Le fichier envoyé n’est pas une image reconnue. Formats acceptés : JPEG, PNG, WebP, GIF, AVIF.',
      );
    }
    if (sourceFormat === 'svg') {
      throw new BadRequestException(
        'Les fichiers SVG ne sont pas acceptés : ce format peut contenir du code exécutable. ' +
          'Envoyez une image JPEG, PNG, WebP, GIF ou AVIF.',
      );
    }
    if (!ACCEPTED_INPUT_FORMATS.includes(sourceFormat)) {
      throw new BadRequestException(
        `Le format ${sourceFormat.toUpperCase()} n’est pas accepté. Formats acceptés : JPEG, PNG, WebP, GIF, AVIF.`,
      );
    }

    try {
      const { data, info } = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS, animated: false })
        .rotate()
        .resize({
          width: EXERCISE_IMAGE_MAX_DIMENSION,
          height: EXERCISE_IMAGE_MAX_DIMENSION,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality: 82, effort: 4 })
        .toBuffer({ resolveWithObject: true });

      return {
        bytes: data,
        contentType: EXERCISE_IMAGE_OUTPUT_CONTENT_TYPE,
        width: info.width,
        height: info.height,
        sourceFormat,
      };
    } catch (error) {
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

/** Format déduit des nombres magiques en tête de fichier — aucune dépendance à sharp, fonction pure testable seule. */
export function detectImageFormat(bytes: Buffer): DetectedImageFormat | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';

  if (bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }

  const leadingSix = bytes.subarray(0, 6).toString('latin1');
  if (leadingSix === 'GIF87a' || leadingSix === 'GIF89a') return 'gif';

  if (
    bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }

  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp';

  const leadingFour = bytes.subarray(0, 4);
  if (
    leadingFour.equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) ||
    leadingFour.equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a]))
  ) {
    return 'tiff';
  }

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
