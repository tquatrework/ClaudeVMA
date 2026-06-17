import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum ProposalStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

@Entity('teacher_proposals')
export class TeacherProposal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'request_id' })
  requestId: string;

  @Column({ name: 'teacher_id' })
  teacherId: string;

  @Column({ type: 'text', nullable: true, name: 'availability_note' })
  availabilityNote: string;

  @Column({ type: 'varchar', default: ProposalStatus.PENDING })
  status: ProposalStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
