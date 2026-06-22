import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

/** Structure d'une ressource liée (exercice, évaluation, tuto, parcours, visio) */
export interface LinkedResource {
  type: string;
  id: string;
  label?: string;
}

/**
 * TextbookEntry — Cahier de texte (journal pédagogique)
 *
 * PLOG-BR-007: conserver auteur, élève concerné, date, visibilité et rattachement activité.
 * PLOG-BR-008: séparé des entrées de carnet personnel.
 */
export type LogVisibility = 'eleve_parent_formateur' | 'eleve_formateur' | 'formateur_rp' | 'special';

@Entity('pedagogical_logs')
export class PedagogicalLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** UUID de l'élève concerné par cette entrée */
  @Column({ name: 'student_id' })
  studentId: string;

  /** UUID de l'auteur (formateur, RP…) */
  @Column({ name: 'author_id' })
  authorId: string;

  /** Rôle de l'auteur au moment de l'écriture */
  @Column({ name: 'author_role' })
  authorRole: string;

  /** Référence optionnelle à une activité ou session visio */
  @Column({ name: 'activity_id', nullable: true })
  activityId: string;

  /** Référence optionnelle à une session visio */
  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  /** Contenu principal de l'entrée */
  @Column({ type: 'text' })
  content: string;

  /**
   * Visibilité de l'entrée :
   * - eleve_parent_formateur : visible par élève, parent et formateur
   * - eleve_formateur         : visible par élève et formateur (pas le parent)
   * - formateur_rp            : page spéciale visible uniquement par formateur et RP (PLOG-BR-006)
   * - special                 : règle de visibilité personnalisée
   */
  @Column({
    type: 'varchar',
    default: 'eleve_parent_formateur',
  })
  visibility: LogVisibility;

  /** Compétences travaillées lors de la séance */
  @Column({ name: 'skills_worked', type: 'simple-array', nullable: true })
  skillsWorked: string[];

  /** Niveau de difficulté perçu */
  @Column({ nullable: true })
  difficulty: string;

  /** Note sur 5 */
  @Column({ nullable: true, type: 'int' })
  rating: number;

  /**
   * Indique s'il s'agit d'une page spéciale (créée par le RP).
   * XML spec functionality 003.
   */
  @Column({ name: 'is_special_page', default: false })
  isSpecialPage: boolean;

  /**
   * Masquer cette page à l'élève.
   * XML spec functionality 003: pages spéciales pouvant être invisibles à l'élève.
   */
  @Column({ name: 'hidden_from_student', default: false })
  hiddenFromStudent: boolean;

  /**
   * Ressources liées (exercices, évaluations, tutos, parcours, visios).
   * Stockées en JSON.
   */
  @Column({ name: 'linked_resources', type: 'simple-json', nullable: true })
  linkedResources: LinkedResource[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
