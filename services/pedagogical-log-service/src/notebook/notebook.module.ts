import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { NotebookController } from './notebook.controller';
import { NotebookService } from './notebook.service';
import { NotebookEntry } from './entities/notebook-entry.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClientsModule } from '../common/clients/clients.module';
import { SettingsModule } from '../settings/settings.module';

/**
 * `ClientsModule` (ProfileRelationsClient) et `SettingsModule`
 * (NotebookAccessSettingsService) sont nécessaires depuis le 2026-08-28 —
 * accès administratif et parental au carnet personnel (docs/architecture.md).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([NotebookEntry]),
    JwtModule.register({}),
    ClientsModule,
    SettingsModule,
  ],
  controllers: [NotebookController],
  providers: [NotebookService, JwtAuthGuard, RolesGuard],
  exports: [NotebookService],
})
export class NotebookModule {}
