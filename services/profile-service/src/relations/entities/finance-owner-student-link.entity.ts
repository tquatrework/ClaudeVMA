import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Links a financeur (parent_financeur) to a student (eleve).
 * One financeur may fund multiple students; one student may have multiple financeurs.
 */
@Entity('finance_owner_student_links')
@Unique(['financeOwnerId', 'studentId'])
export class FinanceOwnerStudentLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'finance_owner_id' })
  financeOwnerId: string;

  @Column('uuid', { name: 'student_id' })
  studentId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
