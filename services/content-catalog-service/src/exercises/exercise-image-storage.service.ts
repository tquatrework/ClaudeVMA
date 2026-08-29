import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Port de stockage des octets des images d'exercice — premier stockage
 * binaire propre à content-catalog-service, volume Docker nommé dédié
 * (`content_catalog_exercise_images`), sur le même patron que l'avatar
 * (2026-08-10) et les images du Mémo (2026-08-27). Nom de fichier stocké
 * généré côté serveur (UUID), jamais dérivé du nom client.
 */
@Injectable()
export class ExerciseImageStorageService {
  private readonly logger = new Logger(ExerciseImageStorageService.name);
  private readonly storagePath: string;

  constructor(private readonly config: ConfigService) {
    this.storagePath =
      this.config.get<string>('EXERCISE_IMAGE_STORAGE_PATH') ??
      path.join(process.cwd(), 'storage', 'exercise-images');
    try {
      fs.mkdirSync(this.storagePath, { recursive: true });
    } catch (error) {
      this.logger.error(
        `Impossible de créer le répertoire de stockage des images d'exercice: ${(error as Error).message}`,
      );
    }
  }

  async save(buffer: Buffer): Promise<string> {
    const storedFilename = randomUUID();
    try {
      await fs.promises.writeFile(this.resolve(storedFilename), buffer);
    } catch (error) {
      this.logger.error(`Écriture de l'image d'exercice impossible: ${(error as Error).message}`);
      throw new InternalServerErrorException("Stockage de l'image d'exercice indisponible");
    }
    return storedFilename;
  }

  async read(storedFilename: string): Promise<Buffer> {
    return fs.promises.readFile(this.resolve(storedFilename));
  }

  async delete(storedFilename: string): Promise<void> {
    await fs.promises.rm(this.resolve(storedFilename), { force: true });
  }

  private resolve(storedFilename: string): string {
    return path.join(this.storagePath, storedFilename);
  }
}
