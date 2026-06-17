import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ArchiveItemType } from '../../common/enums/archive-item-type.enum';

/**
 * Représente un élément dans les archives pédagogiques d'un élève.
 *
 * La donnée n'est pas dupliquée : on stocke un lien (sourceServiceId + sourceService)
 * vers le service source, conformément à la règle "ne pas stocker des copies inutiles".
 *
 * Spec XML : functionalities 001–006, dataEntities PedagogicalArchive / ArchiveItem / ArchiveLink.
 */
@Entity('archive_items')
@Index(['studentId', 'occurredAt'])
export class ArchiveItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** L'élève propriétaire de cette archive */
  @Column({ name: 'student_id' })
  @Index()
  studentId: string;

  /** Type d'élément archivé */
  @Column({ name: 'item_type', type: 'varchar' })
  itemType: ArchiveItemType;

  /**
   * Identifiant de l'entité dans le service source.
   * Ex. : l'ID de la session vidéo dans video-session-service.
   */
  @Column({ name: 'source_id' })
  sourceId: string;

  /** Nom du service source (ex. "pedagogical-log-service") */
  @Column({ name: 'source_service' })
  sourceService: string;

  /** Titre court affiché dans la liste */
  @Column({ name: 'title' })
  title: string;

  /** Description optionnelle */
  @Column({ name: 'description', type: 'text', nullable: true })
  description: string;

  /**
   * URL ou chemin vers le document téléchargeable dans le service source.
   * Null si le type ne supporte pas le téléchargement direct.
   */
  @Column({ name: 'download_url', nullable: true })
  downloadUrl: string;

  /** Score pédagogique associé (exercice, évaluation, contenu élève) */
  @Column({ name: 'score', type: 'decimal', precision: 5, scale: 2, nullable: true })
  score: number;

  /** Points pédagogiques accumulés liés à cet élément */
  @Column({ name: 'pedagogical_points', type: 'int', default: 0 })
  pedagogicalPoints: number;

  /**
   * Date d'occurrence de l'événement (date du cours, de la soumission…)
   * Utilisée pour le tri chronologique et la vue calendrier.
   */
  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  /**
   * Indique si cet élément est accessible par le parent financeur.
   * Doit être false pour CARNET_PERSONNEL (spec XML : règle parent).
   */
  @Column({ name: 'is_parent_visible', default: true })
  isParentVisible: boolean;

  /**
   * Idempotency key pour les appels inter-services rejouables.
   */
  @Column({ name: 'idempotency_key', nullable: true, unique: true })
  idempotencyKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
