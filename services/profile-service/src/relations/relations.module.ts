import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RelationsController } from './relations.controller';
import { RelationsService } from './relations.service';
import { FinanceOwnerStudentLink } from './entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from './entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from './entities/pedagogical-coordinator-link.entity';
import { AnimatorTeacherLink } from './entities/animator-teacher-link.entity';
import { EventsModule } from '../events/events.module';
import { ProfilesModule } from '../profiles/profiles.module';

/**
 * Owns FinanceOwnerStudentLink, TeacherStudentLink, PedagogicalCoordinatorLink
 * and AnimatorTeacherLink.
 * JWT/guards come from the global SecurityModule (see app.module.ts) — this
 * module no longer configures its own JwtModule.
 *
 * Imports ProfilesModule (forwardRef — ProfilesModule already imports this
 * module for RelationsService) solely to consume
 * AdministrativeProfileLookupService, used to enrich relation list responses
 * with the other party's name (firstName/lastName) instead of only their
 * UUID. See ProfilesModule for the full rationale.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FinanceOwnerStudentLink,
      TeacherStudentLink,
      PedagogicalCoordinatorLink,
      AnimatorTeacherLink,
    ]),
    EventsModule,
    forwardRef(() => ProfilesModule),
  ],
  controllers: [RelationsController],
  providers: [RelationsService],
  exports: [RelationsService],
})
export class RelationsModule {}
