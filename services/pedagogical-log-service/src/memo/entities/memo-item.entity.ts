import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { MemoChapter } from './memo-chapter.entity';

/**
 * MemoItem — Élément d'un chapitre de mémo
 *
 * Un item peut être du texte court, une formule LaTeX, ou une image.
 * XML spec data entities: MemoItem, MemoImage.
 * XML spec functionality 004: listes d'items courts, formules mathématiques et images limitées en taille.
 *
 * Refonte du chantier feat/memo-formules (assainissement backend, B4) :
 * les images ne sont plus transportées en base64 dans `content` — elles sont
 * stockées sur un fichier séparé (`MemoImageStorageService`, volume Docker
 * dédié `pedagogical_log_memo_images`), même discipline que
 * `PedagogicalLogAttachment` pour les pièces jointes du cahier de texte.
 * `content` devient nullable : vide ou légende optionnelle pour un item
 * `image`, toujours requis pour `text`/`formula`. `sizeKb` (taille déclarée
 * par le client, jamais vérifiée) est retiré, remplacé par `imageSizeBytes`
 * (taille réelle, mesurée côté serveur après lecture du fichier envoyé).
 *
 * `title` ajoute le 2026-08-27 (correctif d'une regression) : l'ancien
 * modele plat `Memo` (avant l'assainissement du meme jour) portait un
 * `title` optionnel, jamais repris par la migration `CreateMemoTables`
 * d'origine — voir `AddTitleToMemoItems`. Nullable, optionnel pour les
 * trois types d'item (text/formula/image), distinct de `content` (le
 * texte/la formule/la legende) : un court intitule au-dessus de l'item,
 * jamais requis.
 */
export type MemoItemType = 'text' | 'formula' | 'image';

@Entity('memo_items')
export class MemoItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Référence au chapitre parent */
  @Column({ name: 'chapter_id' })
  chapterId: string;

  @ManyToOne(() => MemoChapter, (chapter) => chapter.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chapter_id' })
  chapter: MemoChapter;

  /**
   * Type d'item :
   * - text    : texte court libre
   * - formula : formule mathématique (LaTeX)
   * - image   : image stockée sur fichier séparé (voir champs image* ci-dessous)
   */
  @Column({ type: 'varchar' })
  type: MemoItemType;

  /**
   * Contenu texte : le texte lui-même pour `text`/`formula` (requis), une
   * légende optionnelle pour `image` (nullable).
   */
  @Column({ type: 'text', nullable: true })
  content: string | null;

  /** Titre court, optionnel, pour les trois types d'item — distinct de `content`. */
  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  /** Nom de fichier original fourni par le client (type=image) — affichage uniquement, jamais utilisé comme chemin. */
  @Column({ name: 'image_original_filename', nullable: true })
  imageOriginalFilename: string | null;

  /** Nom de fichier généré côté serveur (UUID, type=image) — identifie le fichier sur le volume dédié. */
  @Column({ name: 'image_stored_filename', nullable: true })
  imageStoredFilename: string | null;

  /** Type MIME détecté sur les octets réels (type=image, jamais l'extension ni le Content-Type client). */
  @Column({ name: 'image_mime_type', nullable: true })
  imageMimeType: string | null;

  /** Taille réelle de l'image en octets (type=image), mesurée côté serveur. */
  @Column({ name: 'image_size_bytes', type: 'integer', nullable: true })
  imageSizeBytes: number | null;

  /** Ordre d'affichage dans le chapitre */
  @Column({ default: 0 })
  order: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
