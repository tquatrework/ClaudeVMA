import { BadRequestException } from '@nestjs/common';
// `import * as` imposé par `export = sharp` + `esModuleInterop: false` — voir
// la note dans src/media/image-transcoder.ts.
import * as sharp from 'sharp';
import {
  AVATAR_MAX_DIMENSION,
  AVATAR_OUTPUT_CONTENT_TYPE,
  ImageTranscoder,
  detectImageFormat,
} from '../../../src/media/image-transcoder';

/**
 * Le cœur de sécurité du lot « photo de profil ».
 *
 * Ce que ces tests protègent, dans l'ordre d'importance :
 *  1. le type est décidé sur les OCTETS, jamais sur ce que dit l'appelant ;
 *  2. le SVG est refusé, y compris déguisé ;
 *  3. les octets stockés sont ceux de l'encodeur, pas ceux reçus — donc toute
 *     charge dissimulée disparaît ;
 *  4. les métadonnées EXIF, dont la géolocalisation, ne survivent pas.
 */
describe('ImageTranscoder', () => {
  let transcoder: ImageTranscoder;

  beforeEach(() => {
    transcoder = new ImageTranscoder();
  });

  /** Image de test réelle : `size` × `size`, unie, dans le format demandé. */
  async function makeImage(
    format: 'jpeg' | 'png' | 'webp' | 'gif' | 'avif',
    size = 800,
  ): Promise<Buffer> {
    const base = sharp({
      create: {
        width: size,
        height: size,
        channels: 3,
        background: { r: 40, g: 90, b: 160 },
      },
    });
    return base.toFormat(format).toBuffer();
  }

  // ---------------------------------------------------------------------------
  // Détection sur les octets réels
  // ---------------------------------------------------------------------------
  describe('detectImageFormat', () => {
    it('reconnaît JPEG, PNG, WebP et GIF sur leurs nombres magiques', async () => {
      expect(detectImageFormat(await makeImage('jpeg', 32))).toBe('jpeg');
      expect(detectImageFormat(await makeImage('png', 32))).toBe('png');
      expect(detectImageFormat(await makeImage('webp', 32))).toBe('webp');
      expect(detectImageFormat(await makeImage('gif', 32))).toBe('gif');
    });

    it('ignore l’extension et le Content-Type : seuls les octets décident', async () => {
      // Un PNG « appelé » JPEG reste un PNG. Le nom du fichier n'est jamais lu
      // par cette fonction — elle ne le reçoit même pas, et c'est délibéré.
      const pngBytes = await makeImage('png', 32);
      expect(detectImageFormat(pngBytes)).toBe('png');
    });

    it('renvoie null pour un fichier qui n’est pas une image', () => {
      expect(detectImageFormat(Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj', 'latin1'))).toBeNull();
      expect(detectImageFormat(Buffer.from('#!/bin/sh\nrm -rf /\n', 'utf8'))).toBeNull();
      expect(detectImageFormat(Buffer.alloc(64))).toBeNull();
    });

    it('renvoie null pour un fichier trop court pour porter une en-tête', () => {
      expect(detectImageFormat(Buffer.from([0xff, 0xd8, 0xff]))).toBeNull();
    });

    it('reconnaît un SVG, y compris précédé d’une déclaration XML, d’un BOM ou d’espaces', () => {
      expect(detectImageFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBe(
        'svg',
      );
      expect(
        detectImageFormat(Buffer.from('<?xml version="1.0"?><svg xmlns="x"><script/></svg>')),
      ).toBe('svg');
      expect(detectImageFormat(Buffer.from('\n\n   <svg width="10"></svg>'))).toBe('svg');
      expect(
        detectImageFormat(
          Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('<svg id="a"></svg>')]),
        ),
      ).toBe('svg');
    });

    it('distingue AVIF de HEIF sur la marque de la boîte ftyp', () => {
      const isobmff = (brand: string) =>
        Buffer.concat([
          Buffer.from([0, 0, 0, 0x20]),
          Buffer.from('ftyp', 'latin1'),
          Buffer.from(brand, 'latin1'),
          Buffer.alloc(16),
        ]);
      expect(detectImageFormat(isobmff('avif'))).toBe('avif');
      expect(detectImageFormat(isobmff('heic'))).toBe('heif');
      expect(detectImageFormat(isobmff('mif1'))).toBe('heif');
    });
  });

  // ---------------------------------------------------------------------------
  // Refus explicites
  // ---------------------------------------------------------------------------
  describe('refus', () => {
    it('refuse un SVG en 400, sans jamais le confier à sharp', async () => {
      const svg = Buffer.from(
        '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">' +
          '<script>alert(1)</script><rect width="100" height="100"/></svg>',
      );

      await expect(transcoder.transcodeToAvatar(svg)).rejects.toThrow(BadRequestException);
      await expect(transcoder.transcodeToAvatar(svg)).rejects.toThrow(/SVG/);
    });

    it('refuse un fichier qui n’est pas une image, message explicite en français', async () => {
      const notAnImage = Buffer.from('MZ\x90\x00\x03\x00\x00\x00 fake executable', 'latin1');

      await expect(transcoder.transcodeToAvatar(notAnImage)).rejects.toThrow(BadRequestException);
      await expect(transcoder.transcodeToAvatar(notAnImage)).rejects.toThrow(
        /n’est pas une image reconnue/,
      );
    });

    it('refuse un HEIC en orientant l’utilisateur vers JPEG ou PNG', async () => {
      const heic = Buffer.concat([
        Buffer.from([0, 0, 0, 0x20]),
        Buffer.from('ftypheic', 'latin1'),
        Buffer.alloc(64),
      ]);

      await expect(transcoder.transcodeToAvatar(heic)).rejects.toThrow(/JPEG ou en PNG/);
    });

    it('refuse un BMP et un TIFF : hors liste blanche', async () => {
      const bmp = Buffer.concat([Buffer.from('BM', 'latin1'), Buffer.alloc(64)]);
      const tiff = Buffer.concat([Buffer.from([0x49, 0x49, 0x2a, 0x00]), Buffer.alloc(64)]);

      await expect(transcoder.transcodeToAvatar(bmp)).rejects.toThrow(/BMP/);
      await expect(transcoder.transcodeToAvatar(tiff)).rejects.toThrow(/TIFF/);
    });

    it('refuse en 400 — pas en 500 — une image annoncée PNG mais tronquée', async () => {
      const truncated = (await makeImage('png', 64)).subarray(0, 40);

      await expect(transcoder.transcodeToAvatar(truncated)).rejects.toThrow(BadRequestException);
      await expect(transcoder.transcodeToAvatar(truncated)).rejects.toThrow(
        /illisible ou endommagé/,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Ré-encodage
  // ---------------------------------------------------------------------------
  describe('ré-encodage', () => {
    it('sort toujours du WebP, quel que soit le format d’entrée', async () => {
      for (const inputFormat of ['jpeg', 'png', 'webp', 'gif'] as const) {
        const result = await transcoder.transcodeToAvatar(await makeImage(inputFormat, 256));

        expect(result.contentType).toBe(AVATAR_OUTPUT_CONTENT_TYPE);
        expect(result.extension).toBe('webp');
        expect(result.sourceFormat).toBe(inputFormat);
        expect(detectImageFormat(result.bytes)).toBe('webp');
      }
    });

    it('borne les dimensions de sortie à 512 px de côté', async () => {
      const result = await transcoder.transcodeToAvatar(await makeImage('jpeg', 2000));

      expect(result.width).toBeLessThanOrEqual(AVATAR_MAX_DIMENSION);
      expect(result.height).toBeLessThanOrEqual(AVATAR_MAX_DIMENSION);

      const metadata = await sharp(result.bytes).metadata();
      expect(metadata.width).toBe(AVATAR_MAX_DIMENSION);
      expect(metadata.height).toBe(AVATAR_MAX_DIMENSION);
    });

    it('n’agrandit pas une petite image', async () => {
      const result = await transcoder.transcodeToAvatar(await makeImage('png', 64));

      expect(result.width).toBeLessThanOrEqual(64);
      expect(result.height).toBeLessThanOrEqual(64);
    });

    it('ne recopie AUCUN octet du fichier reçu : une charge cachée disparaît', async () => {
      // JPEG parfaitement valide, suivi d'une charge arbitraire. Beaucoup de
      // décodeurs l'ignorent et le fichier reste « une image » ; s'il était
      // stocké tel quel, la charge voyagerait avec.
      const payload = Buffer.from('<?php system($_GET["cmd"]); ?>', 'utf8');
      const polyglot = Buffer.concat([await makeImage('jpeg', 128), payload]);

      expect(polyglot.includes(payload)).toBe(true);

      const result = await transcoder.transcodeToAvatar(polyglot);

      expect(result.bytes.includes(payload)).toBe(false);
      expect(detectImageFormat(result.bytes)).toBe('webp');
    });

    it('SUPPRIME les métadonnées EXIF, géolocalisation comprise', async () => {
      // Une photo de profil prise au téléphone porte couramment les
      // coordonnées GPS du domicile. Rien n'oblige la plateforme à les garder.
      const withExif = await sharp({
        create: { width: 600, height: 600, channels: 3, background: { r: 1, g: 2, b: 3 } },
      })
        .withExif({
          IFD0: { Copyright: 'VisioMath', Software: 'test-suite' },
          IFD3: { GPSLatitudeRef: 'N', GPSLongitudeRef: 'E' },
        })
        .jpeg()
        .toBuffer();

      const sourceMetadata = await sharp(withExif).metadata();
      expect(sourceMetadata.exif).toBeDefined();

      const result = await transcoder.transcodeToAvatar(withExif);
      const outputMetadata = await sharp(result.bytes).metadata();

      expect(outputMetadata.exif).toBeUndefined();
      expect(result.bytes.includes(Buffer.from('GPS', 'latin1'))).toBe(false);
      expect(result.bytes.includes(Buffer.from('VisioMath', 'latin1'))).toBe(false);
    });

    it('applique l’orientation EXIF avant de la supprimer : pas de photo couchée', async () => {
      // Image 400×200 marquée « orientation 6 » (rotation d'un quart de tour) :
      // une fois redressée elle devient 200×400, donc plus haute que large.
      // Sans `.rotate()`, la suppression de l'EXIF laisserait l'image couchée.
      const landscape = await sharp({
        create: { width: 400, height: 200, channels: 3, background: { r: 9, g: 9, b: 9 } },
      })
        .withMetadata({ orientation: 6 })
        .jpeg()
        .toBuffer();

      const result = await transcoder.transcodeToAvatar(landscape);
      const metadata = await sharp(result.bytes).metadata();

      expect(metadata.height).toBeGreaterThan(metadata.width as number);
    });
  });
});
