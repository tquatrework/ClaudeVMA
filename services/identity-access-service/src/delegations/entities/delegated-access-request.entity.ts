import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum DelegationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REVOKED = 'revoked',
}

@Entity('delegated_access_requests')
export class DelegatedAccessRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The RP or TI actor requesting delegated access */
  @Column({ name: 'actor_id' })
  actorId: string;

  /** The user whose account is being acted upon */
  @Column({ name: 'target_user_id' })
  targetUserId: string;

  /** Description of the action being delegated */
  @Column({ name: 'action_description', length: 500 })
  actionDescription: string;

  /** Reason / justification provided by the actor */
  @Column({ length: 1000, nullable: true })
  reason: string;

  @Column({
    type: 'enum',
    enum: DelegationStatus,
    default: DelegationStatus.PENDING,
  })
  status: DelegationStatus;

  /** Timestamp when the target user consented (if required) */
  @Column({ name: 'consented_at', nullable: true })
  consentedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
