import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Memo } from './memo.entity';

/**
 * Chapter — Chapitre de classement optionnel pour les mémos d'un élève.
 *
 * Un chapitre appartient exclusivement à un élève propriétaire.
 * Sa suppression ne supprime pas les mémos associés — leurs chapterId passe à null.
 *
 * XML spec data entity: Chapter (pedagogical-log-service.md).
 * XML spec functionality 004: chapitres libres créés par l'élève.
 */
@Entity('chapters')
export class Chapter {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Titre du chapitre (libre, défini par l'élève) */
  @Column()
  title: string;

  /** UUID de l'élève propriétaire — seul cet élève peut lire/écrire ses chapitres */
  @Column({ name: 'student_id' })
  studentId: string;

  /**
   * Mémos associés à ce chapitre.
   * onDelete: 'SET NULL' sur la FK de Memo.chapterId → les mémos ne sont pas supprimés.
   */
  @OneToMany(() => Memo, (memo) => memo.chapter)
  memos: Memo[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
