import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { RelationsModule } from '../relations/relations.module';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { InternalGuard } from './internal.guard';

/**
 * Owns no entities. This module is a system-to-system adapter consumed by
 * orchestration-service (protected by InternalGuard/X-Internal-Secret) that
 * bootstraps profiles and relations during account onboarding. It never
 * injects AdministrativeProfile, StudentPedagogicalProfile,
 * TeacherPedagogicalProfile, FinanceOwnerStudentLink, TeacherStudentLink or
 * PedagogicalCoordinatorLink repositories directly — it imports ProfilesModule
 * and RelationsModule and consumes their exported services.
 */
@Module({
  imports: [ProfilesModule, RelationsModule],
  controllers: [InternalController],
  providers: [InternalService, InternalGuard],
})
export class InternalModule {}
