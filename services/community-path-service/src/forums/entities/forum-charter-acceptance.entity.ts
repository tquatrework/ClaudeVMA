import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

/**
 * Acceptation de la charte de bonne conduite par un utilisateur (arbitrage
 * du 2026-09-04). Un enregistrement par utilisateur, horodaté ; pas de
 * versionnage — accepter à nouveau après un précédent retrait n'est pas un
 * cas prévu par cette spécification (aucun mécanisme de retrait demandé).
 */
@Entity('forum_charter_acceptances')
@Unique(['userId'])
export class ForumCharterAcceptance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @CreateDateColumn()
  acceptedAt: Date;
}
