import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('pedagogical_coordinator_links')
export class PedagogicalCoordinatorLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** RP or AP user ID from identity-access-service */
  @Column({ name: 'coordinator_id' })
  coordinatorId: string;

  @Column({ name: 'student_id' })
  studentId: string;

  /** Tracks whether the coordinator is RP or AP for audit/display */
  @Column({ name: 'coordinator_role' })
  coordinatorRole: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
