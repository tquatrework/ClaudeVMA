import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './entities/contact.entity';
import { ContactRequest } from './entities/contact-request.entity';
import { ContactService } from './contact.service';
import { ContactRequestService } from './contact-request.service';
import { ContactController } from './contact.controller';
import { ProfileServiceClient } from './clients/profile-service.client';
import { IdentityAccessClient } from './clients/identity-access.client';
import { RelationEventConsumerService } from './relation-event-consumer.service';
import { EventsModule } from '../events/events.module';

/**
 * EventsModule is imported (not the other way around) to avoid a circular dependency: the
 * generic outbox/Redis infrastructure knows nothing about Contact, while this module's own
 * consumer (RelationEventConsumerService) needs both the infrastructure and ContactService.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Contact, ContactRequest]), EventsModule],
  controllers: [ContactController],
  providers: [
    ContactService,
    ContactRequestService,
    ProfileServiceClient,
    IdentityAccessClient,
    RelationEventConsumerService,
  ],
  exports: [ContactService, ContactRequestService],
})
export class ContactModule {}
