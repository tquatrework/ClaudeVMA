import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

/**
 * Etat d'une proposition envoyee par le RP a un formateur.
 *
 * `accepted` signifie « le formateur se porte candidat », JAMAIS « le formateur
 * est affecte » : depuis l'arbitrage du 2026-08-12, l'affectation nait de la
 * seule validation du RP.
 *
 * Les deux derniers etats sont crees par cet arbitrage (point 4). Ils ne
 * doivent pas etre confondus avec `declined`, qui veut dire « le formateur a
 * refuse » — les melanger serait un mensonge affiche au formateur.
 */
export enum ProposalStatus {
  /** Envoyee, le formateur n'a pas encore repondu. */
  PENDING = 'pending',
  /** Le formateur se porte candidat. */
  ACCEPTED = 'accepted',
  /** Le formateur a refuse. */
  DECLINED = 'declined',
  /** Le formateur avait accepte, un autre a ete retenu par le RP. */
  NOT_SELECTED = 'not_selected',
  /** Le formateur n'a jamais repondu et la demande a ete cloturee. */
  EXPIRED = 'expired',
}

/** Etats sur lesquels une proposition ne bouge plus. */
export const TERMINAL_PROPOSAL_STATUSES: ProposalStatus[] = [
  ProposalStatus.DECLINED,
  ProposalStatus.NOT_SELECTED,
  ProposalStatus.EXPIRED,
];

@Entity('teacher_proposals')
export class TeacherProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'request_id' })
  requestId: string;

  @Index()
  @Column({ name: 'teacher_id' })
  teacherId: string;

  /**
   * Texte redige par le RP a destination du formateur (arbitrage du
   * 2026-08-12, point 3). Distinct de `description`, porte par la demande et
   * redige par l'eleve : deux donnees, deux auteurs, deux destinataires.
   * Nullable en base pour les propositions creees avant l'arbitrage.
   */
  @Column({ type: 'text', nullable: true })
  message: string;

  /** Champ indicatif optionnel : creneaux possibles, en texte libre. */
  @Column({ type: 'text', nullable: true, name: 'availability_note' })
  availabilityNote: string;

  /** Champ indicatif optionnel : remuneration envisagee, en texte libre. */
  @Column({ type: 'text', nullable: true, name: 'compensation_note' })
  compensationNote: string;

  /** Champ indicatif optionnel : date limite de reponse souhaitee. */
  @Column({ type: 'date', nullable: true, name: 'response_deadline' })
  responseDeadline: string | null;

  @Column({ type: 'varchar', default: ProposalStatus.PENDING })
  status: ProposalStatus;

  /** Horodatage de la reponse du formateur (acceptation ou refus). */
  @Column({ name: 'responded_at', type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
