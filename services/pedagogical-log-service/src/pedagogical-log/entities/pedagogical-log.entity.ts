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
 * PedagogicalLogPage — Cahier de texte (journal pédagogique)
 *
 * PLOG-BR-007: conserver auteur, élève concerné, date, visibilité et rattachement activité.
 * PLOG-BR-008: séparé des entrées de carnet personnel.
 * XML spec: isSpecialPage + hiddenFromStudent pour les pages spéciales parent/financeur (003).
 *
 * Refonte du 2026-08-20 (chantier "refonte du cahier de texte") :
 * - `parent_formateur` remplace `eleve_formateur` : la 2e catégorie de visibilité
 *   exclut désormais l'élève et inclut le parent (l'ancienne définition était erronée).
 * - `content` (texte libre) est retiré des entrées normales du cahier de texte,
 *   remplacé par `date` / `sessionSummary` / `homework`, tous optionnels. La colonne
 *   `content` reste utilisée par le mécanisme des pages spéciales (RP), hors périmètre
 *   de cette refonte, donc laissée nullable et non retirée de l'entité.
 * - `autoCreated` distingue les entrées créées automatiquement à la confirmation
 *   d'une activité de type `cours` (voir EventProcessorService) des entrées saisies
 *   à la main par un formateur.
 * - `remindedAt` garantit un rappel unique au formateur pour une entrée
 *   auto-créée restée vide plus de 24h après la séance (EmptyEntryReminderService).
 */
export type LogVisibility =
  | 'eleve_parent_formateur'
  | 'parent_formateur'
  | 'formateur_rp'
  | 'special';

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

  /**
   * Contenu libre historique — réservé aux pages spéciales du RP (createSpecialPage),
   * mécanisme hors périmètre de la refonte du 2026-08-20, non retiré. Les entrées
   * normales de cahier de texte n'écrivent plus jamais ce champ : elles utilisent
   * date / sessionSummary / homework ci-dessous.
   */
  @Column({ type: 'text', nullable: true })
  content: string;

  /** Date de la séance couverte par cette entrée (pré-remplie à J côté front, optionnelle côté serveur) */
  @Column({ type: 'date', nullable: true })
  date: string;

  /** Déroulement de la séance */
  @Column({ name: 'session_summary', type: 'text', nullable: true })
  sessionSummary: string;

  /** Travail à faire pour la prochaine séance */
  @Column({ type: 'text', nullable: true })
  homework: string;

  /**
   * Visibilité de l'entrée :
   * - eleve_parent_formateur : visible par élève, parent et formateur
   * - parent_formateur        : visible par parent et formateur (pas l'élève) — corrigé le 2026-08-20,
   *                              remplace eleve_formateur qui excluait à tort le parent au lieu de l'élève
   * - formateur_rp            : page spéciale visible uniquement par formateur et RP (PLOG-BR-006)
   * - special                 : règle de visibilité personnalisée
   */
  @Column({
    type: 'varchar',
    default: 'eleve_parent_formateur',
  })
  visibility: LogVisibility;

  /**
   * Indique si c'est une page spéciale (RP uniquement).
   * XML spec functionality 003.
   */
  @Column({ name: 'is_special_page', default: false })
  isSpecialPage: boolean;

  /**
   * Masque la page à l'élève (pages spéciales parent/financeur non visibles par l'élève).
   * XML spec functionality 003: "Pages speciales parent/financeur non visibles par l'eleve si choisies."
   */
  @Column({ name: 'hidden_from_student', default: false })
  hiddenFromStudent: boolean;

  /**
   * Références vers ressources liées (exercices, évaluations, tutos, visios…).
   * XML spec functionality 002. Réservé à une référence interne par UUID+type
   * (futur content-catalog-service, phase 3) — n'accepte pas d'URL externe.
   */
  @Column({ name: 'linked_resources', type: 'simple-json', nullable: true })
  linkedResources: Array<{ type: string; id: string; label?: string }>;

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
   * true si cette entrée a été créée automatiquement à la confirmation d'une
   * activité de type `cours` (ActivityConfirmed), plutôt que saisie par le
   * formateur. Voir EventProcessorService.
   */
  @Column({ name: 'auto_created', default: false })
  autoCreated: boolean;

  /**
   * Horodatage du rappel envoyé au formateur pour une entrée auto-créée restée
   * vide plus de 24h après la séance — garantit un rappel unique (EmptyEntryReminderService).
   */
  @Column({ name: 'reminded_at', type: 'timestamptz', nullable: true })
  remindedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
