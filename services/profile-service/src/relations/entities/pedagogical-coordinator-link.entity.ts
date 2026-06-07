import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Links a Responsable Pédagogique (or AP) as coordinator for a student.
 * PROF-BR-002 / responsibility 4: a student is linked to their RP coordinator.
 * Only one coordinator of a given identity may be linked to a student (unique pair).
 */
@Entity('pedagogical_coordinator_links')
@Unique(['coordinatorId', 'studentId'])
export class PedagogicalCoordinatorLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** RP or AP user ID from identity-access-service */
  @Column('uuid', { name: 'coordinator_id' })
  coordinatorId: string;

  @Column('uuid', { name: 'student_id' })
  studentId: string;

  /** Tracks whether the coordinator is RP or AP for audit/display */
  @Column({ name: 'coordinator_role' })
  coordinatorRole: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
