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
 * XML spec: date + calendarEventId optionnel (lien au calendrier).
 */
@Entity('notebook_entries')
export class NotebookEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID de l'élève propriétaire — seul cet élève peut lire/écrire */
  @Column({ name: 'student_id' })
  studentId: string;

  /** Contenu de l'entrée (texte libre, formules math si possible) */
  @Column({ type: 'text' })
  content: string;

  /** Titre optionnel */
  @Column({ nullable: true })
  title: string;

  /**
   * Date de l'entrée (manuelle ou issue d'un événement calendrier).
   * XML spec data entity PersonalNotebookEntry: "date".
   */
  @Column({ name: 'entry_date', type: 'date', nullable: true })
  entryDate: Date;

  /**
   * Lien optionnel vers un événement du calendrier.
   * XML spec data entity PersonalNotebookEntry: "calendarEventId?".
   */
  @Column({ name: 'calendar_event_id', nullable: true })
  calendarEventId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
