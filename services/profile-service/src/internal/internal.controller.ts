import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalGuard } from './internal.guard';
import { InternalService } from './internal.service';
import { CreateAdministrativeProfileDto } from './dto/create-administrative-profile.dto';
import { CreateStudentProfilesDto } from './dto/create-student-profiles.dto';
import { CreateTeacherProfilesDto } from './dto/create-teacher-profiles.dto';
import { LinkParentDto } from './dto/link-parent.dto';
import { CreateTeacherStudentRelationDto } from './dto/create-teacher-student-relation.dto';
import { LinkCoordinatorDto } from './dto/link-coordinator.dto';

/**
 * System-to-system routes consumed by orchestration-service during account
 * onboarding. Protected by InternalGuard (X-Internal-Secret) instead of the
 * JWT guard — there is no human actor for these calls.
 */
@ApiExcludeController()
@UseGuards(InternalGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Post('create-administrative-profile')
  createAdministrativeProfile(
    @Body() dto: CreateAdministrativeProfileDto,
  ): Promise<Awaited<ReturnType<InternalService['createAdministrativeProfile']>>> {
    return this.internalService.createAdministrativeProfile(dto);
  }

  @Post('create-student-profiles')
  createStudentProfiles(
    @Body() dto: CreateStudentProfilesDto,
  ): Promise<Awaited<ReturnType<InternalService['createStudentProfiles']>>> {
    return this.internalService.createStudentProfiles(dto);
  }

  @Post('create-teacher-profiles')
  createTeacherProfiles(
    @Body() dto: CreateTeacherProfilesDto,
  ): Promise<Awaited<ReturnType<InternalService['createTeacherProfiles']>>> {
    return this.internalService.createTeacherProfiles(dto);
  }

  @Post('link-parent')
  linkParent(
    @Body() dto: LinkParentDto,
  ): Promise<Awaited<ReturnType<InternalService['linkParent']>>> {
    return this.internalService.linkParent(dto);
  }

  @Post('create-teacher-student-relation')
  createTeacherStudentRelation(
    @Body() dto: CreateTeacherStudentRelationDto,
  ): Promise<Awaited<ReturnType<InternalService['createTeacherStudentRelation']>>> {
    return this.internalService.createTeacherStudentRelation(dto);
  }

  @Post('link-coordinator')
  linkCoordinator(
    @Body() dto: LinkCoordinatorDto,
  ): Promise<Awaited<ReturnType<InternalService['linkCoordinator']>>> {
    return this.internalService.linkCoordinator(dto);
  }
}
