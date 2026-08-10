import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from './profiles.controller';
import { ProfileAvatarController } from './profile-avatar.controller';
import { ProfileInternalNotesController } from './profile-internal-notes.controller';
import { TeacherValidationController } from './teacher-validation.controller';
import { ProfilesService } from './profiles.service';
import { AvatarService } from './avatar.service';
import { MediaModule } from '../media/media.module';
import { FieldVisibilityService } from './field-visibility.service';
import { AdministrativeProfileLookupService } from './administrative-profile-lookup.service';
import { AdministrativeProfile } from './entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from './entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from './entities/teacher-pedagogical-profile.entity';
import { InternalProfileNote } from './entities/internal-profile-note.entity';
import { TeacherValidation } from './entities/teacher-validation.entity';
import { ProfileFieldVisibility } from './entities/profile-field-visibility.entity';
import { EventsModule } from '../events/events.module';
import { RelationsModule } from '../relations/relations.module';
import { ClientsModule } from '../common/clients/clients.module';

/**
 * Owns AdministrativeProfile, StudentPedagogicalProfile, TeacherPedagogicalProfile,
 * InternalProfileNote, TeacherValidation and ProfileFieldVisibility.
 *
 * ProfileFieldVisibility remplace ProfileVisibilityPreference (deux booléens
 * nommés en dur) et est servi par FieldVisibilityService, extrait de
 * ProfilesService : celui-ci dépasse déjà largement les seuils de la convention
 * services, et la visibilité par champ n'a besoin d'aucune de ses dépendances.
 *
 * TeacherStudentLink and FinanceOwnerStudentLink belong to RelationsModule:
 * ProfilesService no longer registers or injects those repositories directly.
 * It imports RelationsModule and consumes the exported RelationsService
 * (isTeacherLinkedToStudent / isFinanceOwnerLinkedToStudent) instead.
 *
 * RelationsModule now also imports this module (forwardRef, see below) to
 * consume AdministrativeProfileLookupService — a narrow read-only port used
 * to display the other party's name on relation lists (e.g.
 * GET /relations/finance-owner-student/...). This makes ProfilesModule and
 * RelationsModule mutually dependent at the module-import level, hence the
 * forwardRef() on both sides; there is no provider-level cycle, since
 * AdministrativeProfileLookupService itself does not depend on
 * RelationsService (only ProfilesService does).
 *
 * JWT/guards come from the global SecurityModule (see app.module.ts).
 *
 * MediaModule fournit le port de stockage des octets et le ré-encodeur
 * d'images, consommés par AvatarService (photo de profil). Ce module ne
 * connaît aucune règle métier : ProfilesModule y apporte les droits, lui
 * apporte les octets.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdministrativeProfile,
      StudentPedagogicalProfile,
      TeacherPedagogicalProfile,
      InternalProfileNote,
      TeacherValidation,
      ProfileFieldVisibility,
    ]),
    forwardRef(() => RelationsModule),
    EventsModule,
    ClientsModule,
    MediaModule,
  ],
  controllers: [
    ProfilesController,
    ProfileAvatarController,
    ProfileInternalNotesController,
    TeacherValidationController,
  ],
  providers: [
    ProfilesService,
    AvatarService,
    FieldVisibilityService,
    AdministrativeProfileLookupService,
  ],
  exports: [ProfilesService, FieldVisibilityService, AdministrativeProfileLookupService],
})
export class ProfilesModule {}
