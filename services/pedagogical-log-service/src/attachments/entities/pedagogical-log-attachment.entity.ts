import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PedagogicalLog } from '../../pedagogical-log/entities/pedagogical-log.entity';

/**
 * PedagogicalLogAttachment — pièce jointe d'une entrée de cahier de texte.
 *
 * Propriété de pedagogical-log-service, PAS de archive-document-service :
 * une pièce jointe de cahier de texte est opérationnelle, liée au cycle de
 * vie de l'entrée (supprimée avec elle), pas un document à valeur probante
 * durable — même distinction déjà posée le 2026-08-10 entre la photo de
 * profil et le CV formateur (arbitrage du 2026-08-26, docs/architecture.md
 * "Liens et pièces jointes sur une entrée de cahier de texte", point 3).
 *
 * `storedFilename` est généré côté serveur (UUID), jamais dérivé du nom
 * client — `originalFilename` n'est conservé que pour l'affichage/le
 * téléchargement, jamais utilisé comme chemin de fichier.
 *
 * Limite connue : la suppression d'une entrée (`PedagogicalLogService.remove`)
 * s'appuie sur `ON DELETE CASCADE` pour les lignes, mais ne nettoie pas
 * aujourd'hui les fichiers correspondants sur le volume — fichiers orphelins
 * possibles après suppression d'une entrée avec pièces jointes. Signalé
 * comme point en suspens, non traité dans cette session (hors périmètre
 * demandé).
 */
@Entity('pedagogical_log_attachments')
export class PedagogicalLogAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'log_entry_id' })
  logEntryId: string;

  @ManyToOne(() => PedagogicalLog, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'log_entry_id' })
  logEntry: PedagogicalLog;

  /** Nom de fichier original fourni par le client — affichage uniquement, jamais utilisé comme chemin. */
  @Column({ name: 'original_filename' })
  originalFilename: string;

  /** Nom de fichier généré côté serveur (UUID) — c'est lui qui identifie le fichier sur le volume. */
  @Column({ name: 'stored_filename' })
  storedFilename: string;

  /** Type MIME détecté sur les octets réels (jamais l'extension ni le Content-Type client). */
  @Column({ name: 'mime_type' })
  mimeType: string;

  @Column({ name: 'size_bytes', type: 'integer' })
  sizeBytes: number;

  /** UUID du formateur auteur de l'envoi. */
  @Column({ name: 'uploaded_by' })
  uploadedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
