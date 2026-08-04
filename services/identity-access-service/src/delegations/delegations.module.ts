import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DelegationsController } from './delegations.controller';
import { DelegationsService } from './delegations.service';
import { DelegatedAccessRequest } from './entities/delegated-access-request.entity';
import { EventsModule } from '../events/events.module';
import { AccountsModule } from '../accounts/accounts.module';

// `User` et `AuditLog` sont possédés par AccountsModule : DelegationsModule ne les
// enregistre plus via TypeOrmModule.forFeature et consomme AccountsService à la place.
@Module({
  imports: [TypeOrmModule.forFeature([DelegatedAccessRequest]), EventsModule, AccountsModule],
  controllers: [DelegationsController],
  providers: [DelegationsService],
})
export class DelegationsModule {}
