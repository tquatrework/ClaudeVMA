import { Injectable, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import * as path from 'path';
import * as sharp from 'sharp';
import {
  FORUM_IMAGE_MAX_DIMENSION_PX,
} from '../../common/constants/forum-image.constants';

const FORMAT_TO_MIME: Record<string, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
};

export interface StoredForumImage {
  filename: string;
  mimeType: string;
}

/**
 * Stockage des images d'illustration de forum sur le volume Docker dédié à
 * ce service (jamais un volume d'un autre service — arbitrage du
 * 2026-09-04). Type détecté sur les octets réels via `sharp`, réencodage
 * systématique (donc suppression des métadonnées EXIF), SVG et tout format
 * non supporté par `sharp` explicitement refusés, nom de fichier généré
 * côté serveur.
 */
@Injectable()
export class ForumImageStorageService implements OnModuleInit {
  private readonly storagePath: string;

  constructor(private readonly config: ConfigService) {
    this.storagePath =
      this.config.get<string>('FORUM_IMAGE_STORAGE_PATH') ?? '/app/storage/forum-images';
  }

  async onModuleInit(): Promise<void> {
    await fs.mkdir(this.storagePath, { recursive: true });
  }

  /**
   * Réencode et enregistre une image téléversée. Lève BadRequestException si
   * le format détecté sur les octets réels n'est pas supporté (dont SVG).
   */
  async store(buffer: Buffer): Promise<StoredForumImage> {
    let image: sharp.Sharp;
    let metadata: sharp.Metadata;
    try {
      image = sharp(buffer, { failOn: 'error' });
      metadata = await image.metadata();
    } catch {
      throw new BadRequestException('Fichier image invalide ou illisible');
    }

    const format = metadata.format;
    if (!format || !(format in FORMAT_TO_MIME)) {
      throw new BadRequestException(
        'Format d\'image non supporté. Formats acceptés : JPEG, PNG, WebP, GIF.',
      );
    }

    const resized = image.resize({
      width: FORUM_IMAGE_MAX_DIMENSION_PX,
      height: FORUM_IMAGE_MAX_DIMENSION_PX,
      fit: 'inside',
      withoutEnlargement: true,
    });

    const encoded =
      format === 'jpeg'
        ? await resized.jpeg({ quality: 85 }).toBuffer()
        : format === 'png'
          ? await resized.png().toBuffer()
          : format === 'webp'
            ? await resized.webp({ quality: 85 }).toBuffer()
            : await resized.gif().toBuffer();

    const filename = `${randomUUID()}.${format}`;
    await fs.writeFile(path.join(this.storagePath, filename), encoded);

    return { filename, mimeType: FORMAT_TO_MIME[format] };
  }

  async read(filename: string): Promise<Buffer> {
    return fs.readFile(this.resolveSafePath(filename));
  }

  async remove(filename: string): Promise<void> {
    try {
      await fs.unlink(this.resolveSafePath(filename));
    } catch {
      // Idempotent : un fichier déjà absent n'est pas une erreur.
    }
  }

  /**
   * Empêche toute traversée de répertoire : le nom de fichier vient
   * toujours d'un enregistrement généré côté serveur, jamais d'une saisie
   * utilisateur directe, mais on se protège quand même d'un usage détourné.
   */
  private resolveSafePath(filename: string): string {
    const safeName = path.basename(filename);
    return path.join(this.storagePath, safeName);
  }
}
