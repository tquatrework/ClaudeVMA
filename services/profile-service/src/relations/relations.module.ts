import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RelationsController } from './relations.controller';
import { RelationsService } from './relations.service';
import { FinanceOwnerStudentLink } from './entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from './entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from './entities/pedagogical-coordinator-link.entity';
import { EventsModule } from '../events/events.module';

/**
 * Owns FinanceOwnerStudentLink, TeacherStudentLink and PedagogicalCoordinatorLink.
 * JWT/guards come from the global SecurityModule (see app.module.ts) — this
 * module no longer configures its own JwtModule.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([FinanceOwnerStudentLink, TeacherStudentLink, PedagogicalCoordinatorLink]),
    EventsModule,
  ],
  controllers: [RelationsController],
  providers: [RelationsService],
  exports: [RelationsService],
})
export class RelationsModule {}
