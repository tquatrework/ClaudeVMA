import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { AccountsController } from './accounts.controller';
import { AccountsAdminController } from './accounts-admin.controller';
import { AccountsService } from './accounts.service';
import { User } from '../auth/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, AuditLog]), EventsModule, ConfigModule],
  controllers: [AccountsController, AccountsAdminController],
  providers: [AccountsService],
  exports: [AccountsService],
})
export class AccountsModule {}
