import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

/**
 * Identifiant fixe de l'unique ligne de réglages (singleton). Une clé
 * primaire constante évite toute course à la création concurrente d'une
 * seconde ligne — pas de PrimaryGeneratedColumn ici.
 */
export const PEDAGOGICAL_LOG_SETTINGS_SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

/**
 * PedagogicalLogSettings — réglages système propres à ce service
 * (pièces jointes du cahier de texte). `profile-service` reste propriétaire
 * du plafond de la photo de profil, domaine séparé (arbitrage du 2026-08-26,
 * docs/architecture.md "Liens et pièces jointes sur une entrée de cahier de
 * texte", point 8 : "deux domaines de réglages, chacun chez son
 * propriétaire").
 *
 * Table à une seule ligne (id fixe) — lecture ouverte à tout compte
 * authentifié, écriture réservée au technicien_informatique (point 9).
 */
@Entity('pedagogical_log_settings')
export class PedagogicalLogSettings {
  @PrimaryColumn('uuid')
  id: string;

  /** Interrupteur "pièces jointes activées", par défaut activé (point 7). */
  @Column({ name: 'attachments_enabled', default: true })
  attachmentsEnabled: boolean;

  /** Plafond par fichier, en octets — défaut 100 000 (100 Ko SI, point 6). */
  @Column({ name: 'max_file_bytes', type: 'integer', default: 100000 })
  maxFileBytes: number;

  /** Plafond total par entrée, en octets — défaut 5 000 000 (5 Mo SI, point 6). */
  @Column({ name: 'max_total_bytes_per_entry', type: 'integer', default: 5000000 })
  maxTotalBytesPerEntry: number;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
