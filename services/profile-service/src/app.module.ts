import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RelationsModule } from './relations/relations.module';
import { EventsModule } from './events/events.module';
import { InternalModule } from './internal/internal.module';
import { ParentLinkRequestsModule } from './parent-link-requests/parent-link-requests.module';
import { AdministrativeProfile } from './profiles/entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from './profiles/entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from './profiles/entities/teacher-pedagogical-profile.entity';
import { InternalProfileNote } from './profiles/entities/internal-profile-note.entity';
import { TeacherValidation } from './profiles/entities/teacher-validation.entity';
import { ProfileVisibilityPreference } from './profiles/entities/profile-visibility-preference.entity';
import { FinanceOwnerStudentLink } from './relations/entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from './relations/entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from './relations/entities/pedagogical-coordinator-link.entity';
import { ParentLinkRequest } from './parent-link-requests/entities/parent-link-request.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [
          AdministrativeProfile,
          StudentPedagogicalProfile,
          TeacherPedagogicalProfile,
          InternalProfileNote,
          TeacherValidation,
          ProfileVisibilityPreference,
          FinanceOwnerStudentLink,
          TeacherStudentLink,
          PedagogicalCoordinatorLink,
          ParentLinkRequest,
        ],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    EventsModule,
    ProfilesModule,
    RelationsModule,
    ParentLinkRequestsModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule {}
