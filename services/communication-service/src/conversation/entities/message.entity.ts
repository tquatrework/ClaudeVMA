import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

/**
 * A single message within a conversation.
 * COM-BR-008: a sent message is no longer exclusively owned by its sender.
 * COM-FB-003: a sent message cannot be deleted or modified like a private draft.
 */
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;

  @Column({ name: 'sender_id' })
  senderId: string;

  @Column({ type: 'text' })
  content: string;

  /** Optional attachment reference (file URL / archive document id) */
  @Column({ name: 'attachment_ref', nullable: true })
  attachmentRef: string;

  /** Whether the message is an automated system message (COM-BR-007) */
  @Column({ name: 'is_system', default: false })
  isSystem: boolean;

  @Column({ name: 'is_read', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt: Date;
}
