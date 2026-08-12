import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
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
  in_review: "en cours d'examen",
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
 */
@Entity('teacher_validations')
export class TeacherValidation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The formateur being validated */
  @Column('uuid', { name: 'teacher_id', unique: true })
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
