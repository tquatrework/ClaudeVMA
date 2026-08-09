import { Module } from '@nestjs/common';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';
import { ConsentRecordingModule } from './consent-recording.module';
import { EventsModule } from '../events/events.module';
import { AccountsModule } from '../accounts/accounts.module';

// `User` est possédé par AccountsModule et `ConsentRecord` par
// ConsentRecordingModule : ConsentsModule n'enregistre aucune entité lui-même et
// consomme AccountsService / ConsentRecordingService à la place.
@Module({
  imports: [ConsentRecordingModule, EventsModule, AccountsModule],
  controllers: [ConsentsController],
  providers: [ConsentsService],
})
export class ConsentsModule {}
