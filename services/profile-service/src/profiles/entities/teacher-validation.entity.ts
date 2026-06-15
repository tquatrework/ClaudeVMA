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
  | 'validated'
  | 'rejected';

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
    enum: ['pending', 'validated', 'rejected'],
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
