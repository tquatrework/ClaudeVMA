import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { MemoItem } from './memo-item.entity';

/**
 * MemoChapter — Chapitre du mémo élève
 *
 * Le mémo est un outil EXCLUSIVEMENT élève de formules et trucs essentiels.
 * Seul l'élève peut créer et gérer ses chapitres. XML spec data entity: MemoChapter.
 * XML spec functionality 004: chapitres libres créés par l'élève.
 */
@Entity('memo_chapters')
export class MemoChapter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID de l'élève propriétaire — seul cet élève peut lire/écrire */
  @Column({ name: 'student_id' })
  studentId: string;

  /** Titre du chapitre */
  @Column()
  title: string;

  /** Ordre d'affichage */
  @Column({ default: 0 })
  order: number;

  @OneToMany(() => MemoItem, (item) => item.chapter, { cascade: true })
  items: MemoItem[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
