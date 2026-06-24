import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LegalDocument } from './entities/legal-document.entity';
import { SignatureRecord } from './entities/signature-record.entity';
import { SignDocumentDto } from './dto/sign-document.dto';
import { DocumentStatus } from '../common/enums/document-status.enum';
import { DocumentType } from '../common/enums/document-type.enum';
import { UserRole } from '../common/enums/user-role.enum';

@Injectable()
export class LegalDocumentsService {
  constructor(
    @InjectRepository(LegalDocument)
    private readonly documentRepo: Repository<LegalDocument>,
    @InjectRepository(SignatureRecord)
    private readonly signatureRepo: Repository<SignatureRecord>,
  ) {}

  /**
   * Lists all legal documents belonging to an owner.
   * LDS-FB-001: Only the owner, RP, TI, or AF can list documents.
   */
  async findByOwnerId(ownerId: string, requesterId: string, requesterRole: string): Promise<LegalDocument[]> {
    this.assertCanAccessDocuments(ownerId, requesterId, requesterRole);

    return this.documentRepo.find({
      where: { ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Signs a document. Transition A_SIGNER → SIGNE is unique and non-replayable.
   * LDS-BR-002: Throws 409 Conflict if the document is already signed.
   */
  async signDocument(
    documentId: string,
    dto: SignDocumentDto,
    requesterId: string,
    requesterEmail: string,
    requesterIp?: string,
  ): Promise<{ legalDocument: LegalDocument; signatureRecord: SignatureRecord }> {
    const existingDocument = await this.documentRepo.findOne({
      where: { id: documentId },
      relations: ['signatureRecord'],
    });

    if (!existingDocument) {
      throw new NotFoundException(`Legal document with id ${documentId} not found`);
    }

    if (existingDocument.ownerId !== requesterId) {
      throw new ForbiddenException('LDS-FB-002: Only the document owner can sign it');
    }

    if (existingDocument.status === DocumentStatus.SIGNE) {
      throw new ConflictException(
        'LDS-BR-002: This document has already been signed. Signature is unique and non-replayable.',
      );
    }

    // Transition status to SIGNE
    existingDocument.status = DocumentStatus.SIGNE;
    const updatedDocument = await this.documentRepo.save(existingDocument);

    // Create immutable signature record
    const signatureRecord = this.signatureRepo.create({
      legalDocumentId: documentId,
      signerId: requesterId,
      signerName: dto.signerName,
      signerEmail: requesterEmail,
      templateVersion: existingDocument.templateVersion,
      signerIp: requesterIp ?? null,
    });
    const savedSignatureRecord = await this.signatureRepo.save(signatureRecord);

    return { legalDocument: updatedDocument, signatureRecord: savedSignatureRecord };
  }

  /**
   * Checks whether the required document for an owner is signed.
   * Used by the internal route for orchestration-service.
   * Returns status for each document type.
   */
  async checkSignatureStatus(ownerId: string): Promise<{
    ownerId: string;
    mandatClientSigne: boolean;
    contratFormateurSigne: boolean;
    documents: Array<{ documentType: string; status: string; signedAt?: Date }>;
  }> {
    const allDocuments = await this.documentRepo.find({
      where: { ownerId },
      relations: ['signatureRecord'],
      order: { createdAt: 'DESC' },
    });

    const mandatClientDocument = allDocuments.find(
      (doc) => doc.documentType === DocumentType.MANDAT_CLIENT,
    );
    const contratFormateurDocument = allDocuments.find(
      (doc) => doc.documentType === DocumentType.CONTRAT_FORMATEUR,
    );

    return {
      ownerId,
      mandatClientSigne: mandatClientDocument?.status === DocumentStatus.SIGNE,
      contratFormateurSigne: contratFormateurDocument?.status === DocumentStatus.SIGNE,
      documents: allDocuments.map((doc) => ({
        documentType: doc.documentType,
        status: doc.status,
        signedAt: doc.signatureRecord?.signedAt,
      })),
    };
  }

  // --- Access control helpers ---

  /**
   * LDS-FB-001: Only the document owner or internal roles (RP, TI, AF) can access.
   */
  private assertCanAccessDocuments(
    ownerId: string,
    requesterId: string,
    requesterRole: string,
  ): void {
    const authorizedInternalRoles: string[] = [
      UserRole.RESPONSABLE_PEDAGOGIQUE,
      UserRole.TECHNICIEN_INFORMATIQUE,
      UserRole.ADMINISTRATEUR_FINANCIER,
    ];
    if (requesterId === ownerId) return;
    if (authorizedInternalRoles.includes(requesterRole)) return;
    throw new ForbiddenException(
      'LDS-FB-001: You may only access your own legal documents unless you hold an internal role',
    );
  }
}
