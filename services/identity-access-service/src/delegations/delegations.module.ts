import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';
import { DelegatedAccessRequest } from './entities/delegated-access-request.entity';
import { User } from '../auth/entities/user.entity';
import { AuditLog } from '../accounts/entities/audit-log.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([DelegatedAccessRequest, User, AuditLog]), EventsModule],
  controllers: [DelegationsController],
  providers: [DelegationsService],
})
export class DelegationsModule {}
