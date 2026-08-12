import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Lien parent financeur → élève.
 * Un financeur peut financer plusieurs élèves ; un élève peut avoir plusieurs
 * financeurs.
 *
 * DÉLIER N'EFFACE PAS. Rompre le lien renseigne `endedAt`/`endedBy`, jamais un
 * `DELETE`. Même raisonnement que le retrait d'un consentement (arbitrage du
 * 2026-08-09) : on doit pouvoir prouver que le lien a existé, puis a été rompu,
 * et QUAND — un lien financier disparu sans trace serait ingérable côté
 * facturation. La table est donc un journal : `finance_owner_student_links`
 * n'est jamais purgée.
 *
 * Conséquence sur l'unicité : la contrainte porte sur le lien ACTIF, pas sur la
 * paire. Un index unique PARTIEL (`WHERE ended_at IS NULL`) autorise autant de
 * liens rompus qu'on veut pour une même paire tout en interdisant deux liens
 * actifs simultanés — c'est ce qui rend le rattachement de nouveau possible
 * après une rupture. Une contrainte d'unicité pleine l'interdirait
 * définitivement, exactement le piège du `409 "Consent already signed"` qui
 * portait sur l'existence d'une ligne au lieu de l'état courant.
 */
@Entity('finance_owner_student_links')
@Index('UQ_finance_owner_student_links_active', ['financeOwnerId', 'studentId'], {
  unique: true,
  where: '"ended_at" IS NULL',
})
export class FinanceOwnerStudentLink {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'finance_owner_id' })
  financeOwnerId: string;

  @Column('uuid', { name: 'student_id' })
  studentId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  /**
   * Date de rupture du lien. `null` = lien ACTIF : c'est le seul critère lu par
   * toutes les requêtes de ce service (droit de lecture du profil, statistiques,
   * archives via `/internal/relations`). Renseigner cette colonne referme donc
   * tous les droits ouverts par la relation, sans qu'aucun appelant ait à le
   * savoir.
   */
  @Column('timestamp', { name: 'ended_at', nullable: true })
  endedAt: Date | null;

  /**
   * Qui a rompu le lien — l'une des deux parties, un RP ou un TI. La rupture est
   * une action sensible : à défaut d'intégration avec `admin-observability-service`
   * (aucun client vers ce service dans `profile-service` à ce jour), la base
   * garde au minimum l'auteur et l'horodatage.
   */
  @Column('uuid', { name: 'ended_by', nullable: true })
  endedBy: string | null;
}
