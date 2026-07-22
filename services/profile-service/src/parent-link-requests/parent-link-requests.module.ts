import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParentLinkRequestsController } from './parent-link-requests.controller';
import { ParentLinkRequestsService } from './parent-link-requests.service';
import { ParentLinkRequest } from './entities/parent-link-request.entity';
import { ProfilesModule } from '../profiles/profiles.module';
import { RelationsModule } from '../relations/relations.module';

/**
 * Owns ParentLinkRequest only. StudentPedagogicalProfile (profiles feature) and
 * FinanceOwnerStudentLink (relations feature) are no longer registered here —
 * ParentLinkRequestsService consumes ProfilesService and RelationsService
 * instead of injecting their repositories directly.
 *
 * JWT/guards come from the global SecurityModule (see app.module.ts).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ParentLinkRequest]),
    ProfilesModule,
    RelationsModule,
  ],
  controllers: [ParentLinkRequestsController],
  providers: [ParentLinkRequestsService],
  exports: [ParentLinkRequestsService],
})
export class ParentLinkRequestsModule {}
