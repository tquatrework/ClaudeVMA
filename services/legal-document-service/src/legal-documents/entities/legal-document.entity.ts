import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { DocumentStatus } from '../../common/enums/document-status.enum';
import { DocumentType } from '../../common/enums/document-type.enum';
import { SignatureRecord } from './signature-record.entity';

/**
 * Represents a legal document assigned to a user.
 * LDS-BR-002: Status transitions A_SIGNER → SIGNE are unique and non-replayable.
 * LDS-BR-003: MANDAT_CLIENT is required for member account validation.
 * LDS-BR-004: CONTRAT_FORMATEUR is required for teacher validation.
 */
@Entity('legal_documents')
export class LegalDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The user this document belongs to */
  @Column({ name: 'owner_id' })
  ownerId: string;

  /** Type of document */
  @Column({ name: 'document_type', type: 'varchar' })
  documentType: DocumentType;

  /** Current status — only A_SIGNER → SIGNE transition is allowed */
  @Column({ name: 'status', type: 'varchar', default: DocumentStatus.A_SIGNER })
  status: DocumentStatus;

  /** ID of the template version used to generate this document */
  @Column({ name: 'template_id' })
  templateId: string;

  /** Version number of the template at document generation time */
  @Column({ name: 'template_version' })
  templateVersion: number;

  /** Snapshot of the document content at issuance time */
  @Column({ name: 'content_snapshot', type: 'text' })
  contentSnapshot: string;

  @OneToOne(() => SignatureRecord, (sig) => sig.legalDocument, {
    cascade: true,
    eager: true,
    nullable: true,
  })
  signatureRecord: SignatureRecord;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
