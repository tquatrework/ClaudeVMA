import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Chapter } from './chapter.entity';

/**
 * Memo — Formulaire structuré appartenant à l'élève
 *
 * Le mémo est un outil personnel de l'élève (formules, trucs essentiels, chapitres libres).
 * Il N'EST PAS une note interne du personnel.
 * Seul l'élève propriétaire crée, modifie et supprime ses propres entrées.
 * Les acteurs autorisés (formateur lié, RP, AP) peuvent lire en lecture seule.
 *
 * XML spec func 004, 005 — PLOG-BR-003.
 */
@Entity('memos')
export class Memo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID de l'élève propriétaire du mémo */
  @Column({ name: 'student_id' })
  studentId: string;

  /** Contenu du mémo (texte libre, formules, etc.) */
  @Column({ type: 'text' })
  content: string;

  /** Titre du chapitre ou entrée de mémo */
  @Column({ nullable: true })
  title: string;

  /** Activité concernée (optionnel — lien contextuel pendant une visio) */
  @Column({ name: 'activity_id', nullable: true })
  activityId: string;

  /**
   * Chapitre de classement optionnel (nullable).
   * Quand le Chapter est supprimé, cette FK passe à null (onDelete: 'SET NULL').
   * Les mémos sans chapitre apparaissent sous la catégorie virtuelle "Général".
   */
  @ManyToOne(() => Chapter, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'chapter_id' })
  chapter: Chapter | null;

  @Column({ name: 'chapter_id', type: 'uuid', nullable: true })
  chapterId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
