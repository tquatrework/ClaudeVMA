/**
 * Unit tests — detectImageFormat (fonction pure, aucune dépendance à sharp)
 * et ExerciseImageTranscoder.transcode() (nominal + erreurs).
 */

import { BadRequestException } from '@nestjs/common';
import {
  detectImageFormat,
  ExerciseImageTranscoder,
  EXERCISE_IMAGE_OUTPUT_CONTENT_TYPE,
} from '../../../src/exercises/exercise-image-transcoder';

// PNG 1x1 valide (transparent), pour un test de bout en bout du ré-encodage réel.
const TINY_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

describe('detectImageFormat()', () => {
  it('détecte un JPEG sur ses nombres magiques', () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(detectImageFormat(bytes)).toBe('jpeg');
  });

  it('détecte un PNG sur sa signature', () => {
    const bytes = Buffer.from(TINY_PNG_BASE64, 'base64');
    expect(detectImageFormat(bytes)).toBe('png');
  });

  it('détecte un GIF87a/GIF89a', () => {
    const bytes = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(10)]);
    expect(detectImageFormat(bytes)).toBe('gif');
  });

  it('détecte un WebP (RIFF....WEBP)', () => {
    const bytes = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]);
    expect(detectImageFormat(bytes)).toBe('webp');
  });

  it('détecte un SVG malgré une déclaration XML', () => {
    const bytes = Buffer.from('<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectImageFormat(bytes)).toBe('svg');
  });

  it('détecte un SVG direct sans déclaration XML', () => {
    const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(detectImageFormat(bytes)).toBe('svg');
  });

  it('retourne null pour un contenu non reconnu', () => {
    const bytes = Buffer.from('ceci nest pas une image du tout, juste du texte');
    expect(detectImageFormat(bytes)).toBeNull();
  });

  it('retourne null pour un buffer trop court', () => {
    expect(detectImageFormat(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe('ExerciseImageTranscoder.transcode()', () => {
  let transcoder: ExerciseImageTranscoder;

  beforeEach(() => {
    transcoder = new ExerciseImageTranscoder();
  });

  it('ré-encode une image PNG valide en WebP', async () => {
    const bytes = Buffer.from(TINY_PNG_BASE64, 'base64');
    const result = await transcoder.transcode(bytes);

    expect(result.contentType).toBe(EXERCISE_IMAGE_OUTPUT_CONTENT_TYPE);
    expect(result.sourceFormat).toBe('png');
    expect(result.bytes.length).toBeGreaterThan(0);
  });

  it('refuse un SVG explicitement', async () => {
    const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    await expect(transcoder.transcode(bytes)).rejects.toThrow(BadRequestException);
  });

  it('refuse un contenu non reconnu comme image', async () => {
    const bytes = Buffer.from('pas une image');
    await expect(transcoder.transcode(bytes)).rejects.toThrow(BadRequestException);
  });

  it('refuse un fichier corrompu dont l\'en-tête est valide mais le contenu illisible', async () => {
    // En-tête JPEG valide, contenu tronqué juste après.
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    await expect(transcoder.transcode(bytes)).rejects.toThrow(BadRequestException);
  });
});
