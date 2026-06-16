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
   * - image   : image encodée base64 ou URL (limitée à 500 Ko)
   */
  @Column({ type: 'varchar' })
  type: MemoItemType;

  /** Contenu : texte, LaTeX ou données image (base64/URL) */
  @Column({ type: 'text' })
  content: string;

  /**
   * Taille de l'image en Ko (uniquement pour type=image).
   * XML spec: "images limitees en taille" — limite appliquée en service (500 Ko).
   */
  @Column({ name: 'size_kb', nullable: true, type: 'int' })
  sizeKb: number;

  /** Ordre d'affichage dans le chapitre */
  @Column({ default: 0 })
  order: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
