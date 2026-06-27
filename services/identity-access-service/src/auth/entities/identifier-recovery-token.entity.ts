import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

/**
 * Stocke un token temporaire utilisé pour tracer les demandes de récupération d'identifiant.
 * Le token est hashé — jamais stocké en clair.
 */
@Entity('identifier_recovery_tokens')
export class IdentifierRecoveryToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Email ciblé par la demande */
  @Column({ name: 'email' })
  email: string;

  @Column({ name: 'token_hash' })
  tokenHash: string;

  @Column({ name: 'expires_at' })
  expiresAt: Date;

  @Column({ name: 'used_at', nullable: true, type: 'timestamptz' })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
