import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { LegalDocument } from './entities/legal-document.entity';
import { SignatureRecord } from './entities/signature-record.entity';
import { LegalDocumentsController } from './legal-documents.controller';
import { LegalDocumentsService } from './legal-documents.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([LegalDocument, SignatureRecord]),
    JwtModule.register({}),
  ],
  controllers: [LegalDocumentsController],
  providers: [LegalDocumentsService, JwtAuthGuard, RolesGuard],
  exports: [LegalDocumentsService],
})
export class LegalDocumentsModule {}
