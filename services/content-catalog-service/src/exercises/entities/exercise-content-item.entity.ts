import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExercisePart } from './exercise-part.entity';
import { ExerciseSolution } from './exercise-solution.entity';

export type ExerciseContentItemType = 'text' | 'formula' | 'image';

/**
 * ExerciseContentItem — élément de contenu texte/formule/image, sur le même
 * mécanisme que le Mémo (`pedagogical-log-service`, `MemoItem`) : un item est
 * du texte court, une formule LaTeX, ou une image stockée sur fichier séparé
 * (`ExerciseImageStorageService`, volume Docker dédié).
 *
 * Rattaché à EXACTEMENT UN parent : soit un bloc (`partId`), soit une
 * solution (`solutionId`) — jamais les deux, jamais aucun. Un seul type
 * d'item plutôt que deux tables identiques dupliquées : `ExercisePart` et
 * `ExerciseSolution` partagent la même forme de contenu, seul le parent
 * diffère (arbitrage de simplicité de code, docs/architecture.md).
 *
 * `content` est requis pour `text`/`formula` (le texte/la formule elle-même),
 * optionnel pour `image` (légende).
 */
@Entity('exercise_content_items')
export class ExerciseContentItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  partId: string | null;

  @ManyToOne(() => ExercisePart, (part) => part.items, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'partId' })
  part: ExercisePart | null;

  @Column({ nullable: true })
  solutionId: string | null;

  @ManyToOne(() => ExerciseSolution, (solution) => solution.items, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'solutionId' })
  solution: ExerciseSolution | null;

  @Column({ type: 'varchar' })
  type: ExerciseContentItemType;

  /** Texte/formule pour `text`/`formula` (requis), légende optionnelle pour `image`. */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  /** Nom de fichier original fourni par le client (type=image) — affichage uniquement, jamais un chemin. */
  @Column({ nullable: true })
  imageOriginalFilename: string | null;

  /** Nom de fichier généré côté serveur (UUID, type=image) — identifie le fichier sur le volume dédié. */
  @Column({ nullable: true })
  imageStoredFilename: string | null;

  /** Type MIME de sortie du ré-encodage (type=image, toujours image/webp). */
  @Column({ nullable: true })
  imageMimeType: string | null;

  /** Taille réelle du fichier ré-encodé en octets (type=image). */
  @Column({ type: 'integer', nullable: true })
  imageSizeBytes: number | null;

  /** Ordre d'affichage au sein du parent (bloc ou solution). */
  @Column({ default: 0 })
  order: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
