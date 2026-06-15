import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Memo — Notes rapides liées à une activité ou un élève
 *
 * Un mémo peut être créé par formateur, RP ou AP pour noter rapidement
 * une observation, un rappel ou une information contextuelle.
 */
@Entity('memos')
export class Memo {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID de l'auteur du mémo */
  @Column({ name: 'author_id' })
  authorId: string;

  /** Rôle de l'auteur au moment de la création */
  @Column({ name: 'author_role' })
  authorRole: string;

  /** Élève concerné (optionnel) */
  @Column({ name: 'student_id', nullable: true })
  studentId: string;

  /** Activité concernée (optionnel) */
  @Column({ name: 'activity_id', nullable: true })
  activityId: string;

  /** Contenu du mémo */
  @Column({ type: 'text' })
  content: string;

  /** Titre du mémo */
  @Column({ nullable: true })
  title: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
