import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Cycle de vie d'une demande de professeur (arbitrage du 2026-08-12).
 *
 *   pending ──(le RP envoie des propositions)──> redirected ──(le RP valide un
 *   candidat)──> closed
 *
 * `closed` est l'etat TERMINAL cree par l'arbitrage : sans lui, l'etape 8 du
 * flow (« les demandes traitees disparaissent de l'interface ») etait
 * inexprimable, `assigned` n'ayant aucune transition sortante.
 *
 * Les valeurs marquees LEGACY ne sont plus jamais ecrites par le flow. Elles
 * restent declarees parce que des lignes de la base les portent encore : les
 * retirer de l'enum ferait echouer la lecture de ces lignes. `assigned` garde
 * une transition sortante vers `closed` pour que les demandes bloquees par
 * l'ancien modele (« le premier formateur qui accepte gagne ») puissent etre
 * cloturees.
 */
export enum RequestStatus {
  PENDING = 'pending',
  REDIRECTED = 'redirected',
  CLOSED = 'closed',
  CANCELLED = 'cancelled',
  DECLINED = 'declined',
  /** LEGACY — ancienne affectation immediate a l'acceptation d'un formateur. */
  ASSIGNED = 'assigned',
  /** LEGACY — jamais ecrit par le flow retenu. */
  ACCEPTED = 'accepted',
  /** LEGACY — modele « le RP preselectionne, le client choisit », abandonne. */
  CANDIDATES_PUBLISHED = 'candidates_published',
  /** LEGACY — jamais ecrit par aucun code, meme avant l'arbitrage. */
  CANDIDATES_SELECTED = 'candidates_selected',
  /** LEGACY — modele abandonne. */
  CANDIDATE_CHOSEN = 'candidate_chosen',
}

/** Statuts sur lesquels une demande ne bouge plus : elle a ete traitee. */
export const TERMINAL_REQUEST_STATUSES: RequestStatus[] = [
  RequestStatus.CLOSED,
  RequestStatus.CANCELLED,
  RequestStatus.DECLINED,
];

/** Statuts d'une demande encore en cours de traitement. */
export const OPEN_REQUEST_STATUSES: RequestStatus[] = [
  RequestStatus.PENDING,
  RequestStatus.REDIRECTED,
  RequestStatus.ASSIGNED,
  RequestStatus.ACCEPTED,
  RequestStatus.CANDIDATES_PUBLISHED,
  RequestStatus.CANDIDATES_SELECTED,
  RequestStatus.CANDIDATE_CHOSEN,
];

export enum RequestType {
  SPECIFIC = 'specific',
  PP_CHANGE = 'pp_change',
}

@Entity('teacher_requests')
export class TeacherRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'requester_id' })
  requesterId: string;

  @Column({ name: 'requester_role' })
  requesterRole: string;

  @Index()
  @Column({ name: 'student_id' })
  studentId: string;

  /**
   * Le SEUL champ de saisie de la demande (arbitrage du 2026-08-12, point 2) :
   * texte long, requis cote DTO. Nullable en base uniquement parce que les
   * lignes anterieures a l'arbitrage n'en portent pas.
   */
  @Column({ type: 'text', nullable: true })
  description: string;

  /**
   * LEGACY. Sortis du flow le 2026-08-12 : plus aucun ecran ne les demande,
   * aucune route ne les exige. Conserves tant qu'ils portent des donnees.
   */
  @Column({ nullable: true })
  subject: string;

  @Column({ nullable: true })
  level: string;

  @Column({ nullable: true })
  sector: string;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Index()
  @Column({ type: 'varchar', default: RequestStatus.PENDING })
  status: RequestStatus;

  @Column({ type: 'varchar', default: RequestType.SPECIFIC })
  type: RequestType;

  @Column({ name: 'current_pp_teacher_id', nullable: true })
  currentPpTeacherId: string;

  /** LEGACY — modele « le RP preselectionne, le client choisit », abandonne. */
  @Column({ name: 'selected_teacher_ids', type: 'simple-array', nullable: true })
  selectedTeacherIds: string[];

  /** Formateur retenu par le RP lors de la validation. */
  @Column({ name: 'chosen_teacher_id', nullable: true })
  chosenTeacherId: string;

  /** Horodatage de la validation du RP, qui cloture la demande. */
  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
