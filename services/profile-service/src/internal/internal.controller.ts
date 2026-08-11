import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { InternalGuard } from './internal.guard';
import { InternalService } from './internal.service';
import { CreateAdministrativeProfileDto } from './dto/create-administrative-profile.dto';
import { CreateStudentProfilesDto } from './dto/create-student-profiles.dto';
import { CreateTeacherProfilesDto } from './dto/create-teacher-profiles.dto';
import { LinkParentDto } from './dto/link-parent.dto';
import { CreateTeacherStudentRelationDto } from './dto/create-teacher-student-relation.dto';
import { LinkCoordinatorDto } from './dto/link-coordinator.dto';
import { ResolveRelationQueryDto } from './dto/resolve-relation.query.dto';

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

  /**
   * `GET /internal/relations/:viewerId/:targetId?viewerRole=<rôle>`
   *
   * Renvoie la NATURE et le SENS des relations entre deux personnes, pour qu'un
   * service appelant applique sa propre règle sans tenir de copie des relations
   * (`archive-document-service` en premier). Voir `InternalService.resolveRelation`.
   *
   * `viewerRole` est obligatoire (`400` s'il manque ou s'il est inconnu) : le
   * rôle accompagne systématiquement les appels interservices.
   */
  @Get('relations/:viewerId/:targetId')
  resolveRelation(
    @Param('viewerId', ParseUUIDPipe) viewerId: string,
    @Param('targetId', ParseUUIDPipe) targetId: string,
    @Query() query: ResolveRelationQueryDto,
  ): Promise<Awaited<ReturnType<InternalService['resolveRelation']>>> {
    return this.internalService.resolveRelation(viewerId, targetId, query.viewerRole);
  }
}
