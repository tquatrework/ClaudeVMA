import { Module } from '@nestjs/common';
import { ProfilesModule } from '../profiles/profiles.module';
import { RelationsModule } from '../relations/relations.module';
import { ClientsModule } from '../common/clients/clients.module';
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
 *
 * ClientsModule fournit IdentityAccessClient, utilisé UNIQUEMENT sur le chemin
 * d'erreur de la résolution de nom : distinguer un userId inconnu (404) d'un
 * compte existant sans profil administratif (500, incohérence de données).
 * Le cas nominal ne provoque aucun appel sortant.
 */
@Module({
  imports: [ProfilesModule, RelationsModule, ClientsModule],
  controllers: [InternalController],
  providers: [InternalService, InternalGuard],
})
export class InternalModule {}
