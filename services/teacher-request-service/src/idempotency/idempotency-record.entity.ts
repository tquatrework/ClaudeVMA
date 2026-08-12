import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Unique } from 'typeorm';

/**
 * Trace d'une commande deja executee, indexee par la cle d'idempotence fournie
 * par l'appelant (`Idempotency-Key`).
 *
 * Contrat technique du projet (`<contract id="idempotency">`) : trois POST
 * identiques ne doivent pas creer trois demandes. Mesure le 2026-08-11 : ils en
 * creaient trois.
 *
 * La cle est portee par un triplet (cle, route, utilisateur) : deux
 * utilisateurs peuvent employer la meme cle sans se marcher dessus, et une meme
 * cle rejouee sur une autre route reste une autre commande.
 */
@Entity('idempotency_records')
@Unique('UQ_idempotency_key_endpoint_user', ['idempotencyKey', 'endpoint', 'userId'])
export class IdempotencyRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'idempotency_key' })
  idempotencyKey: string;

  /** Identifiant logique de la commande, ex. `POST /requests`. */
  @Column()
  endpoint: string;

  @Column({ name: 'user_id' })
  userId: string;

  /** Reponse renvoyee la premiere fois, restituee telle quelle au rejeu. */
  @Column({ name: 'response_body', type: 'jsonb' })
  responseBody: unknown;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
