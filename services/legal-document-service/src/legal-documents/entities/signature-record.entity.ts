import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { LegalDocument } from './legal-document.entity';

/**
 * Immutable record of a legal document signature.
 * LDS-BR-002: Created once when a document is signed. Never updated.
 */
@Entity('signature_records')
export class SignatureRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** The document this signature record belongs to */
  @OneToOne(() => LegalDocument, (doc) => doc.signatureRecord)
  @JoinColumn({ name: 'legal_document_id' })
  legalDocument: LegalDocument;

  @Column({ name: 'legal_document_id' })
  legalDocumentId: string;

  /** ID of the user who signed */
  @Column({ name: 'signer_id' })
  signerId: string;

  /** Full name of the signer at signature time */
  @Column({ name: 'signer_name' })
  signerName: string;

  /** Email of the signer at signature time */
  @Column({ name: 'signer_email' })
  signerEmail: string;

  /** Version of the template that was signed */
  @Column({ name: 'template_version' })
  templateVersion: number;

  /** IP address of the signer (for audit purposes) */
  @Column({ name: 'signer_ip', nullable: true })
  signerIp: string;

  /** Timestamp of the signature — immutable */
  @CreateDateColumn({ name: 'signed_at' })
  signedAt: Date;
}
