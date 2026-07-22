import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';
import { ConsentRecord } from './entities/consent-record.entity';
import { EventsModule } from '../events/events.module';
import { AccountsModule } from '../accounts/accounts.module';

// `User` est possédé par AccountsModule : ConsentsModule ne l'enregistre plus
// via TypeOrmModule.forFeature et consomme AccountsService à la place.
@Module({
  imports: [TypeOrmModule.forFeature([ConsentRecord]), EventsModule, AccountsModule],
  controllers: [ConsentsController],
  providers: [ConsentsService],
})
export class ConsentsModule {}
