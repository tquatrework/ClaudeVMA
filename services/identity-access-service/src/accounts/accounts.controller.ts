import { Controller, Post, Get, Patch, Body, Query, Ip } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateStudentAccountDto } from './dto/create-student-account.dto';
import { CreateTeacherAccountDto } from './dto/create-teacher-account.dto';
import { CreateParentAccountDto } from './dto/create-parent-account.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import {
  AccountResponseDto,
  CheckEmailResponseDto,
  StudentAccountCreationResponseDto,
  ParentAccountCreationResponseDto,
} from './dto/account-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { StrictBody } from '../common/guards/reject-unknown-body-fields.guard';

/**
 * Racine de ressource `accounts` — volet self-service : inscription (publique)
 * et mise à jour de son propre compte. Le volet administration (RP/TI) est sur
 * AccountsAdminController, dans le même module, pour respecter la limite de
 * taille de fichier (controllers-convention).
 */
@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @StrictBody(CreateAccountDto)
  @ApiOperation({
    summary: 'Create account',
    description:
      'Self-register as eleve, parent_financeur or formateur. Consents accepted in the registration form ' +
      'can be sent in `consents` ([{consentType, version?}]): they are recorded in consent_records exactly ' +
      'like POST /consents (same default version, same ip_address and signed_at). The account is created ' +
      'ACTIVE when rgpd and cgu are both provided, PENDING otherwise. Any field this route does not declare ' +
      'is rejected with 400 rather than silently dropped.',
  })
  @ApiResponse({ status: 201, description: 'Account created — ACTIVE if rgpd + cgu consents were provided, PENDING otherwise. emailAlreadyUsed:true if email was already registered.' })
  @ApiResponse({ status: 400, description: 'Validation error — unknown field in body, or duplicated consentType in consents' })
  @ApiResponse({ status: 409, description: 'Login identifier already taken' })
  @ApiResponse({ status: 403, description: 'Attempt to self-register with an internal role' })
  createAccount(@Body() dto: CreateAccountDto, @Ip() ipAddress: string): Promise<AccountResponseDto> {
    return this.accountsService.createAccount(dto, ipAddress);
  }

  @Post('students')
  @StrictBody(CreateStudentAccountDto)
  @ApiOperation({
    summary: 'Create student account',
    description:
      'Self-register as an eleve. Optionally attach an existing parent financeur account or create one in ' +
      "the same call — the intent is explicit via parentAccountMode ('existing' | 'new' | 'none'). " +
      'In both cases the finance-owner-student relation is created automatically (no approval flow). ' +
      'The login identifier of a created parent account is chosen (parentLoginIdentifier), never derived ' +
      'from its email. RGPD/CGU acceptance collected in the form is sent in `consents` ' +
      '([{consentType, version?}]) and recorded in consent_records exactly like POST /consents: the student ' +
      'account is then created ACTIVE, PENDING otherwise. These consents cover the student only — a parent ' +
      'account created in the same call stays PENDING and signs its own via POST /consents. ' +
      'firstName, lastName, phoneNumber and birthDate are forwarded to profile-service ' +
      '(POST /internal/create-administrative-profile) and never stored here: this service owns neither the ' +
      'identity data nor a birth date column. birthDate is optional, ISO YYYY-MM-DD, and an impossible date ' +
      'is rejected with a 400 here rather than turned into a 503 by profile-service. No birth date is ' +
      'collected for the linked parent account (no parentBirthDate field). Any field this ' +
      'route does not declare is rejected with 400 rather than silently dropped.',
  })
  @ApiResponse({ status: 201, description: 'Student (and optionally parent) account created — student ACTIVE if rgpd + cgu consents were provided, PENDING otherwise; a created parent account is always PENDING. emailAlreadyUsed:true if email was already registered.' })
  @ApiResponse({
    status: 400,
    description:
      'Validation error — unknown field in body (e.g. parentBirthDate, which no form collects), ' +
      'birthDate not formatted as an ISO calendar date YYYY-MM-DD, ' +
      'duplicated consentType in consents, parentAccountMode missing while parent* fields are sent, ' +
      'required field missing for the chosen mode, or field with no effect in that mode (never silently ignored)',
  })
  @ApiResponse({ status: 409, description: 'Login identifier already taken (student or created parent)' })
  @ApiResponse({ status: 404, description: "parentLoginIdentifier not found (parentAccountMode='existing')" })
  @ApiResponse({ status: 503, description: 'profile-service unavailable — account creation rolled back, no data was lost' })
  createStudentAccount(
    @Body() dto: CreateStudentAccountDto,
    @Ip() ipAddress: string,
  ): Promise<StudentAccountCreationResponseDto> {
    return this.accountsService.createStudentAccount(dto, ipAddress);
  }

  @Post('teachers')
  @StrictBody(CreateTeacherAccountDto)
  @ApiOperation({
    summary: 'Create teacher account',
    description:
      'Self-register as a formateur. RGPD/CGU acceptance collected in the form is sent in `consents` ' +
      '([{consentType, version?}]) and recorded in consent_records exactly like POST /consents. ' +
      'Professional validation by the RP (interview/test, contract, financial information) remains ' +
      'required before the teacher can actually work — it is tracked separately from consents. ' +
      'Any field this route does not declare is rejected with 400 rather than silently dropped: ' +
      'teaching subjects, education level and biography belong to the pedagogical profile owned by ' +
      'profile-service, not to this route.',
  })
  @ApiResponse({ status: 201, description: 'Teacher account created — ACTIVE if rgpd + cgu consents were provided, PENDING (non_approved) otherwise. emailAlreadyUsed:true if email was already registered.' })
  @ApiResponse({ status: 400, description: 'Validation error — unknown field in body, or duplicated consentType in consents' })
  @ApiResponse({ status: 409, description: 'Login identifier already taken' })
  @ApiResponse({ status: 503, description: 'profile-service unavailable — account creation rolled back, no data was lost' })
  createTeacherAccount(@Body() dto: CreateTeacherAccountDto, @Ip() ipAddress: string): Promise<AccountResponseDto> {
    return this.accountsService.createTeacherAccount(dto, ipAddress);
  }

  @Post('parents')
  @StrictBody(CreateParentAccountDto)
  @ApiOperation({
    summary: 'Create parent financeur account',
    description:
      'Self-register as a parent_financeur. Allows a financing parent to create an account independently, ' +
      'without going through the student registration flow. The parent chooses its own loginIdentifier ' +
      '(same contract as POST /accounts/students and /accounts/teachers). Optionally attach an existing ' +
      'student (eleve) account or create one in the same call — the intent is explicit via ' +
      "studentAccountMode ('existing' | 'new' | 'none'), symmetric to parentAccountMode on " +
      'POST /accounts/students. When a student is attached or created in the same call, the ' +
      'finance-owner-student relation is created automatically (no approval flow). RGPD/CGU acceptance ' +
      'collected in the form is sent in `consents` ([{consentType, version?}]) and recorded in ' +
      'consent_records exactly like POST /consents: the parent account is then created ACTIVE, PENDING ' +
      'otherwise. These consents cover the parent only — a student account created in the same call stays ' +
      'PENDING and signs its own via POST /consents, a consent never being presumed from someone else. ' +
      'Any field this route does not declare is rejected with 400 rather than silently dropped.',
  })
  @ApiResponse({ status: 201, description: 'Parent (and optionally student) account created — parent ACTIVE if rgpd + cgu consents were provided, PENDING otherwise; a created student account is always PENDING. emailAlreadyUsed:true if email was already registered.' })
  @ApiResponse({
    status: 400,
    description:
      'Validation error — unknown field in body, duplicated consentType in consents, studentAccountMode ' +
      'missing while student* fields are sent, required field missing for the chosen mode, or field with ' +
      'no effect in that mode (never silently ignored)',
  })
  @ApiResponse({ status: 409, description: 'Login identifier already taken (parent or created student)' })
  @ApiResponse({ status: 404, description: "studentLoginIdentifier not found (studentAccountMode='existing')" })
  @ApiResponse({ status: 503, description: 'profile-service unavailable — account creation rolled back, no data was lost' })
  createParentAccount(
    @Body() dto: CreateParentAccountDto,
    @Ip() ipAddress: string,
  ): Promise<ParentAccountCreationResponseDto> {
    return this.accountsService.createParentAccount(dto, ipAddress);
  }

  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Update own account',
    description:
      'Update the authenticated user\'s own account. Only email and password can be changed. ' +
      'Role and status modifications are handled by dedicated admin routes.',
  })
  @ApiResponse({ status: 200, description: 'Account updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error — invalid email, identifier too short or password too short' })
  @ApiResponse({ status: 401, description: 'Unauthorized — JWT required' })
  @ApiResponse({ status: 409, description: 'Login identifier already in use' })
  updateMe(@Body() dto: UpdateMeDto, @CurrentUser() actor: AuthenticatedUser): Promise<AccountResponseDto> {
    return this.accountsService.updateMe(actor.id, dto);
  }

  @Get('check-email')
  @ApiOperation({
    summary: 'Check email availability',
    description:
      'Public endpoint. Returns whether an email is already associated with one or more accounts, ' +
      'and suggests a loginIdentifier that would be available for a new account with that email.',
  })
  @ApiQuery({ name: 'email', required: true, description: 'Email address to check' })
  @ApiResponse({ status: 200, description: 'Check result — alreadyUsed and suggestedLoginIdentifier' })
  checkEmail(@Query('email') email: string): Promise<CheckEmailResponseDto> {
    return this.accountsService.checkEmail(email);
  }
}
