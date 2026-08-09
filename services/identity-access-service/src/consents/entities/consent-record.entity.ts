import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

export enum ConsentType {
  RGPD = 'rgpd',
  CGU = 'cgu',
  MARKETING = 'marketing',
}

export const REQUIRED_CONSENTS: ConsentType[] = [ConsentType.RGPD, ConsentType.CGU];

/**
 * Version appliquée quand l'appelant n'en fournit pas explicitement. Constante
 * unique : `POST /consents` et les routes de création de compte enregistrent la
 * même version par défaut, la trace d'un consentement ne devant pas dépendre du
 * chemin par lequel il a été recueilli.
 */
export const DEFAULT_CONSENT_VERSION = '1.0';

@Entity('consent_records')
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id' })
  userId: string;

  @Column({ name: 'consent_type', type: 'enum', enum: ConsentType })
  consentType: ConsentType;

  @Column({ default: '1.0' })
  version: string;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress: string;

  @CreateDateColumn({ name: 'signed_at' })
  signedAt: Date;
}
