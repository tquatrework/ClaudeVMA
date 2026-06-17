import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * PersonalNotebookEntry — Carnet personnel de l'élève
 *
 * PLOG-BR-004: élément propre à l'élève.
 * PLOG-BR-008: séparé des entrées de cahier de texte.
 * PLOG-FB-001: le parent ne doit JAMAIS accéder à ces entrées.
 * PLOG-FB-002: ne pas retourner dans les APIs du cahier de texte.
 */
@Entity('notebook_entries')
export class NotebookEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID de l'élève propriétaire — seul cet élève peut lire/écrire */
  @Column({ name: 'student_id' })
  studentId: string;

  /** Contenu de l'entrée */
  @Column({ type: 'text' })
  content: string;

  /** Titre optionnel */
  @Column({ nullable: true })
  title: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
