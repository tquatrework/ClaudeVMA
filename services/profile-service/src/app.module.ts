import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { ProfilesModule } from './profiles/profiles.module';
import { RelationsModule } from './relations/relations.module';
import { EventsModule } from './events/events.module';
import { InternalModule } from './internal/internal.module';
import { AdministrativeProfile } from './profiles/entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from './profiles/entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from './profiles/entities/teacher-pedagogical-profile.entity';
import { InternalProfileNote } from './profiles/entities/internal-profile-note.entity';
import { FinanceOwnerStudentLink } from './relations/entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from './relations/entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from './relations/entities/pedagogical-coordinator-link.entity';

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
          FinanceOwnerStudentLink,
          TeacherStudentLink,
          PedagogicalCoordinatorLink,
        ],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    EventsModule,
    ProfilesModule,
    RelationsModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule {}
