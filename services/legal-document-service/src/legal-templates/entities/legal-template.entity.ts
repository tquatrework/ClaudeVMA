import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { DocumentType } from '../../common/enums/document-type.enum';

/**
 * Represents a legal document template editable by administrateur_financier only.
 * LDS-BR-001: Seul l'AF peut créer ou modifier les modèles.
 */
@Entity('legal_templates')
export class LegalTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Human-readable name for this template */
  @Column({ name: 'title' })
  title: string;

  /** Type of document this template generates */
  @Column({ name: 'document_type', type: 'varchar' })
  documentType: DocumentType;

  /** Version number — incremented on each update */
  @Column({ name: 'version', default: 1 })
  version: number;

  /** Rich text / HTML content of the template */
  @Column({ name: 'content', type: 'text' })
  content: string;

  /** Whether this template is the active one for its document type */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** ID of the AF user who created this template */
  @Column({ name: 'created_by' })
  createdBy: string;

  /** ID of the AF user who last modified this template */
  @Column({ name: 'last_modified_by', nullable: true })
  lastModifiedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
