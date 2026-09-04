import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * Outbox transactionnel des événements de domaine publiés par ce service.
 *
 * Réplique exactement le pattern déjà construit pour `teacher-request-service`
 * (arbitrage du 2026-08-14, `docs/architecture/cahier-texte-notifications-carnet.md`
 * > « Systeme de notifications transversal ») : `EventsService.publish()` se
 * contentait jusqu'ici d'un `logger.log()` — un « événement » qui n'est qu'une
 * ligne de log n'en est pas un, comme le rappelle l'arbitrage du 2026-08-12
 * (`docs/architecture/demande-professeur.md`, point 7). `publish()` écrit
 * désormais une ligne ici en plus du log ; `EventPublisherService` balaie les
 * lignes non publiées et les `XADD` sur le stream Redis `visiomath:events`.
 *
 * Besoin déclencheur (2026-09-04, `docs/architecture/contacts-messagerie.md`) :
 * `communication-service` a construit un consommateur complet de ce flux pour
 * dériver des contacts par défaut (AP↔formateur, élève↔parent, élève↔formateur)
 * et constate, en lisant directement le stream réel, qu'aucun de ces
 * événements n'y figure jamais — `profile-service` les journalisait localement
 * mais ne les publiait pas.
 *
 * NON TRANSACTIONNEL avec l'écriture métier qui déclenche l'événement (même
 * limite assumée que `teacher-request-service`, documentée au point 2 de
 * l'arbitrage du 2026-08-14) : `publish()` insère cette ligne juste après la
 * sauvegarde de l'entité métier, pas dans la même transaction. La fenêtre de
 * risque est la même que celle qui existe déjà aujourd'hui entre la sauvegarde
 * et l'appel `this.events.publish(...)` — ce chantier ne l'aggrave pas, il fait
 * seulement en sorte que la publication survive un redémarrage du service au
 * lieu de ne vivre que dans les logs.
 *
 * Idempotence à la charge du CONSOMMATEUR (même règle que le 2026-08-14,
 * point 2) : `XADD` n'est pas transactionnel avec la mise à jour de
 * `published_at` — un crash entre les deux republierait le même `id` au
 * redémarrage. `communication-service` doit donc dédupliquer par `eventId`,
 * qu'il fait déjà (`processed_events`, voir son rapport de session du
 * 2026-09-04).
 */
@Entity('domain_events')
export class DomainEventOutbox {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 100 })
  type: string;

  @Column('jsonb')
  payload: Record<string, unknown>;

  @Column('timestamptz', { name: 'occurred_at' })
  occurredAt: Date;

  /**
   * `NULL` tant que l'événement n'a pas été confirmé publié sur Redis (`XADD`
   * réussi). L'index partiel ci-dessous rend le balayage périodique
   * (`WHERE published_at IS NULL`) bon marché même quand la table grossit,
   * une fois la grande majorité des lignes publiées.
   */
  @Column('timestamptz', { name: 'published_at', nullable: true })
  @Index('idx_domain_events_unpublished', { where: '"published_at" IS NULL' })
  publishedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
