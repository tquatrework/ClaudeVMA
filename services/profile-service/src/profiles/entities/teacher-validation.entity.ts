import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';

export type TeacherValidationStatus =
  | 'pending'
  | 'in_review'
  | 'validated'
  | 'rejected';

export const TEACHER_VALIDATION_STATUSES: TeacherValidationStatus[] = [
  'pending',
  'in_review',
  'validated',
  'rejected',
];

/**
 * Libellés français des statuts, EN UN SEUL POINT (règle de langue du
 * 2026-08-09 : les clés d'API sont en anglais, tout ce que l'utilisateur lit est
 * en français, et la correspondance nom technique ↔ libellé n'est jamais
 * éparpillée — sinon un même statut finit par porter deux libellés selon le
 * message d'erreur).
 *
 * Ces libellés servent aux messages d'erreur du serveur. Le front porte les
 * siens pour l'affichage : ce sont deux surfaces distinctes, et le serveur ne
 * peut pas compter sur le front pour formuler un refus.
 */
const TEACHER_VALIDATION_STATUS_LABELS: Record<TeacherValidationStatus, string> = {
  pending: 'en attente',
  in_review: 'en cours d’examen',
  validated: 'validé',
  rejected: 'refusé',
};

export function statusLabel(status: string): string {
  return (
    TEACHER_VALIDATION_STATUS_LABELS[status as TeacherValidationStatus] ?? status
  );
}

/**
 * Tracks the RP validation status of a formateur.
 * PROF-BR: only RP or TI may change validation status.
 * Event emitted: TeacherValidated
 *
 * JOURNAL APPEND-ONLY (arbitrage du 2026-08-13, « Reprise de candidature après
 * un refus formateur », point 5) : jusqu'ici UNE ligne par formateur, réécrite
 * à chaque transition — le refus disparaissait dès la ligne suivante, rendant
 * impossible toute preuve qu'un formateur avait été refusé puis autorisé à se
 * représenter. Même mécanique que `consent_records`
 * (identity-access-service) et que les tables de relation de ce service
 * (`finance_owner_student_links`, `teacher_student_links`) : chaque transition
 * INSÈRE une nouvelle ligne, aucune n'est jamais réécrite ni supprimée. Le
 * statut courant d'un formateur se lit comme sa ligne la plus RÉCENTE
 * (`ORDER BY created_at DESC`, `id` en départage — voir
 * `ProfilesService.findLatestTeacherValidation`).
 *
 * Conséquence sur `teacherId` : il n'est PLUS unique (voir la migration
 * `MakeTeacherValidationsAppendOnly`) — une contrainte d'unicité interdirait
 * justement la nouvelle ligne `pending` d'une reprise de candidature.
 */
@Entity('teacher_validations')
@Index('IDX_teacher_validations_teacher_id_created_at', ['teacherId', 'createdAt'])
export class TeacherValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Le formateur concerné. Volontairement NON UNIQUE : une même personne porte
   * autant de lignes que de transitions de statut au fil de sa vie sur la
   * plateforme (voir le commentaire de classe).
   */
  @Column('uuid', { name: 'teacher_id' })
  teacherId: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'in_review', 'validated', 'rejected'],
    default: 'pending',
  })
  status: TeacherValidationStatus;

  /** Actor who performed the last status change */
  @Column('uuid', { name: 'validated_by', nullable: true })
  validatedBy: string;

  @Column({
    name: 'validator_role',
    type: 'enum',
    enum: UserRole,
    nullable: true,
  })
  validatorRole: UserRole;

  /** Free-text explanation (rejection reason, validation notes…) */
  @Column({ type: 'text', nullable: true })
  comment: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
