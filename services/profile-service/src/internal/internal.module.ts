import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdministrativeProfile } from '../profiles/entities/administrative-profile.entity';
import { StudentPedagogicalProfile } from '../profiles/entities/student-pedagogical-profile.entity';
import { TeacherPedagogicalProfile } from '../profiles/entities/teacher-pedagogical-profile.entity';
import { FinanceOwnerStudentLink } from '../relations/entities/finance-owner-student-link.entity';
import { TeacherStudentLink } from '../relations/entities/teacher-student-link.entity';
import { PedagogicalCoordinatorLink } from '../relations/entities/pedagogical-coordinator-link.entity';
import { InternalController } from './internal.controller';
import { InternalService } from './internal.service';
import { InternalGuard } from './internal.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AdministrativeProfile,
      StudentPedagogicalProfile,
      TeacherPedagogicalProfile,
      FinanceOwnerStudentLink,
      TeacherStudentLink,
      PedagogicalCoordinatorLink,
    ]),
  ],
  controllers: [InternalController],
  providers: [InternalService, InternalGuard],
})
export class InternalModule {}
