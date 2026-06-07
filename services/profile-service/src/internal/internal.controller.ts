import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, IsArray } from 'class-validator';
import { InternalGuard } from './internal.guard';
import { InternalService } from './internal.service';

class CreateStudentProfilesDto {
  @IsUUID() accountId: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() birthDate?: string;
  @IsOptional() @IsString() level?: string;
}

class CreateTeacherProfilesDto {
  @IsUUID() accountId: string;
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsArray() subjects?: string[];
  @IsOptional() @IsArray() levels?: string[];
  @IsOptional() @IsString() bio?: string;
}

class LinkParentDto {
  @IsUUID() studentId: string;
  @IsUUID() financeOwnerId: string;
}

class CreateTeacherStudentRelationDto {
  @IsUUID() teacherId: string;
  @IsUUID() studentId: string;
  @IsOptional() isPrincipalTeacher?: boolean;
}

@ApiExcludeController()
@UseGuards(InternalGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly internalService: InternalService) {}

  @Post('create-student-profiles')
  createStudentProfiles(@Body() dto: CreateStudentProfilesDto) {
    return this.internalService.createStudentProfiles(dto);
  }

  @Post('create-teacher-profiles')
  createTeacherProfiles(@Body() dto: CreateTeacherProfilesDto) {
    return this.internalService.createTeacherProfiles(dto);
  }

  @Post('link-parent')
  linkParent(@Body() dto: LinkParentDto) {
    return this.internalService.linkParent(dto);
  }

  @Post('create-teacher-student-relation')
  createTeacherStudentRelation(@Body() dto: CreateTeacherStudentRelationDto) {
    return this.internalService.createTeacherStudentRelation(dto);
  }
}
