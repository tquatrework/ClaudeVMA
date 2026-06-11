import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Message } from './message.entity';

/**
 * A conversation thread between two or more authorized participants.
 * COM-BR-010: participants are derived from business relations (profile-service),
 * not freely chosen by the user.
 */
@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Ordered list of participant userIds */
  @Column({ type: 'text', array: true, name: 'participant_ids' })
  participantIds: string[];

  /** Optional label for the conversation (auto-generated or context-based) */
  @Column({ nullable: true })
  subject: string;

  /** Whether this conversation is an incident thread (COM-RA-006) */
  @Column({ name: 'is_incident', default: false })
  isIncident: boolean;

  /** For incident threads: optional incidentId reference */
  @Column({ name: 'incident_id', nullable: true })
  incidentId: string;

  @OneToMany(() => Message, (msg) => msg.conversation, { cascade: false })
  messages: Message[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
