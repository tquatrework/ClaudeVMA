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
} from './dto/account-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';

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
  @ApiOperation({
    summary: 'Create account',
    description: 'Self-register as eleve, parent_financeur or formateur. Account starts in PENDING status until required consents are signed.',
  })
  @ApiResponse({ status: 201, description: 'Account created — status PENDING. emailAlreadyUsed:true if email was already registered.' })
  @ApiResponse({ status: 409, description: 'Login identifier already taken' })
  @ApiResponse({ status: 403, description: 'Attempt to self-register with an internal role' })
  createAccount(@Body() dto: CreateAccountDto, @Ip() ipAddress: string): Promise<AccountResponseDto> {
    return this.accountsService.createAccount(dto, ipAddress);
  }

  @Post('students')
  @ApiOperation({
    summary: 'Create student account',
    description:
      'Self-register as an eleve. Optionally create a linked parent financeur account in the same call. ' +
      'Account starts in PENDING status. RGPD acceptance must follow via /consents.',
  })
  @ApiResponse({ status: 201, description: 'Student (and optionally parent) account created — status PENDING. emailAlreadyUsed:true if email was already registered.' })
  @ApiResponse({ status: 409, description: 'Login identifier already taken, or multiple parent accounts share the given parentEmail' })
  @ApiResponse({ status: 404, description: 'parentLoginIdentifier not found' })
  createStudentAccount(
    @Body() dto: CreateStudentAccountDto,
    @Ip() ipAddress: string,
  ): Promise<StudentAccountCreationResponseDto> {
    return this.accountsService.createStudentAccount(dto, ipAddress);
  }

  @Post('teachers')
  @ApiOperation({
    summary: 'Create teacher account',
    description:
      'Self-register as a formateur. Account is created in NON_APPROVED status until the RP validates ' +
      'after interview/test, contract signing and financial information submission.',
  })
  @ApiResponse({ status: 201, description: 'Teacher account created — status PENDING (non_approved). emailAlreadyUsed:true if email was already registered.' })
  @ApiResponse({ status: 409, description: 'Login identifier already taken' })
  createTeacherAccount(@Body() dto: CreateTeacherAccountDto, @Ip() ipAddress: string): Promise<AccountResponseDto> {
    return this.accountsService.createTeacherAccount(dto, ipAddress);
  }

  @Post('parents')
  @ApiOperation({
    summary: 'Create parent financeur account',
    description:
      'Self-register as a parent_financeur. Allows a financing parent to create an account independently, ' +
      'without going through the student registration flow. Account starts in PENDING status.',
  })
  @ApiResponse({ status: 201, description: 'Parent account created — status PENDING' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  createParentAccount(@Body() dto: CreateParentAccountDto, @Ip() ipAddress: string): Promise<AccountResponseDto> {
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
