import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AccountsController } from './accounts.controller';
import { AccountsAdminController } from './accounts-admin.controller';
import { AccountsService } from './accounts.service';
import { User } from '../auth/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { EventsModule } from '../events/events.module';
import { ClientsModule } from '../common/clients/clients.module';
import { ConsentRecordingModule } from '../consents/consent-recording.module';

// ConsentRecordingModule : les routes de création de compte enregistrent les
// consentements du formulaire d'inscription par le même chemin que
// POST /consents (arbitrage du 2026-08-09). Ce module ne dépend d'aucun autre
// module métier, il n'introduit donc pas de cycle avec ConsentsModule (qui, lui,
// importe AccountsModule).
@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuditLog]),
    EventsModule,
    ConfigModule,
    ClientsModule,
    ConsentRecordingModule,
  ],
  controllers: [AccountsController, AccountsAdminController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
