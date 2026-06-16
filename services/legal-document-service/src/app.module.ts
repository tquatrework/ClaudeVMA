import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LegalDocumentsModule } from './legal-documents/legal-documents.module';
import { LegalTemplatesModule } from './legal-templates/legal-templates.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { LegalDocument } from './legal-documents/entities/legal-document.entity';
import { SignatureRecord } from './legal-documents/entities/signature-record.entity';
import { LegalTemplate } from './legal-templates/entities/legal-template.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [LegalDocument, SignatureRecord, LegalTemplate],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    LegalDocumentsModule,
    LegalTemplatesModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule {}
