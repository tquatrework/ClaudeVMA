import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { LegalDocumentsModule } from '../legal-documents/legal-documents.module';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';

@Module({
  imports: [LegalDocumentsModule],
  controllers: [InternalController],
  providers: [InternalSecretGuard],
})
export class InternalModule {}
