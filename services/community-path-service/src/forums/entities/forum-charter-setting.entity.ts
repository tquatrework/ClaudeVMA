import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Réglage global de la charte de bonne conduite des forums (arbitrage du
 * 2026-09-04). Une seule ligne en base (singleton) : la charte est unique
 * pour toute la plateforme, pas une par forum. Pas de versionnage — le
 * texte courant écrase le précédent.
 */
@Entity('forum_charter_settings')
export class ForumCharterSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', default: '' })
  content: string;

  @Column({ nullable: true })
  updatedByUserId: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
