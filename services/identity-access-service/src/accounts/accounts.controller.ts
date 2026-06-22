import {
  Controller,
  Post,
  Get,
  Put,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Ip,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from './accounts.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { CreateStudentAccountDto } from './dto/create-student-account.dto';
import { CreateTeacherAccountDto } from './dto/create-teacher-account.dto';
import { CreateParentAccountDto } from './dto/create-parent-account.dto';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { UpdateMeDto } from './dto/update-me.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@ApiTags('accounts')
@Controller('accounts')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create account',
    description: 'Self-register as eleve, parent_financeur or formateur. Account starts in PENDING status until required consents are signed.',
  })
  @ApiResponse({ status: 201, description: 'Account created — status PENDING' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  @ApiResponse({ status: 403, description: 'Attempt to self-register with an internal role' })
  createAccount(@Body() dto: CreateAccountDto, @Ip() ipAddress: string) {
    return this.accountsService.createAccount(dto, ipAddress);
  }

  @Post('students')
  @ApiOperation({
    summary: 'Create student account',
    description:
      'Self-register as an eleve. Optionally create a linked parent financeur account in the same call. ' +
      'Account starts in PENDING status. RGPD acceptance must follow via /consents.',
  })
  @ApiResponse({ status: 201, description: 'Student account created — status PENDING' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  createStudentAccount(@Body() dto: CreateStudentAccountDto, @Ip() ipAddress: string) {
    return this.accountsService.createStudentAccount(dto, ipAddress);
  }

  @Post('teachers')
  @ApiOperation({
    summary: 'Create teacher account',
    description:
      'Self-register as a formateur. Account is created in NON_APPROVED status until the RP validates ' +
      'after interview/test, contract signing and financial information submission.',
  })
  @ApiResponse({ status: 201, description: 'Teacher account created — status PENDING (non_approved)' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  createTeacherAccount(@Body() dto: CreateTeacherAccountDto, @Ip() ipAddress: string) {
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
  createParentAccount(@Body() dto: CreateParentAccountDto, @Ip() ipAddress: string) {
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
  @ApiResponse({ status: 400, description: 'Validation error — invalid email or password too short' })
  @ApiResponse({ status: 401, description: 'Unauthorized — JWT required' })
  @ApiResponse({ status: 409, description: 'Email already in use' })
  updateMe(@Body() dto: UpdateMeDto, @Request() req) {
    return this.accountsService.updateMe(req.user.id, dto);
  }

  @Get(':accountId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ADMINISTRATEUR_FINANCIER)
  @ApiOperation({ summary: 'Get account', description: 'Retrieve account details — TI, RP, AdministrateurFinancier only' })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Account details' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  getAccount(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.accountsService.getAccount(accountId);
  }

  @Put(':accountId/roles')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Update role',
    description: 'Assign a new role to an account. Only RP or TI can perform this. Every change is audit-logged.',
  })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Role updated — change is audited' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  updateRoles(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateRolesDto,
    @Request() req,
  ) {
    return this.accountsService.updateRoles(accountId, dto, req.user);
  }

  @Put(':accountId/validate')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Validate account',
    description: 'Set account status to ACTIVE. Requires that mandatory consents have been signed.',
  })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Account validated' })
  @ApiResponse({ status: 403, description: 'Consents not yet signed or insufficient role' })
  validateAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Request() req,
  ) {
    return this.accountsService.validateAccount(accountId, req.user);
  }

  @Put(':accountId/suspend')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({ summary: 'Suspend account', description: 'Deactivate an account. TI only.' })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Account suspended' })
  @ApiResponse({ status: 403, description: 'TI role required' })
  suspendAccount(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Request() req,
  ) {
    return this.accountsService.suspendAccount(accountId, req.user);
  }

  @Patch(':accountId/status')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Update account status',
    description:
      'Change the business status of an account: limited, member, non_approved, validated or suspended. ' +
      'Only TI can set suspended. Only RP or TI can change status. Every change is audit-logged.',
  })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Status updated — change is audited' })
  @ApiResponse({ status: 403, description: 'Insufficient role or consent not signed' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  updateAccountStatus(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Body() dto: UpdateAccountStatusDto,
    @Request() req,
  ) {
    return this.accountsService.updateAccountStatus(accountId, dto, req.user);
  }

  @Post(':accountId/access/regenerate')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({
    summary: 'Regenerate account access (TI only)',
    description:
      'Reactivate a suspended or blocked account and revoke all existing sessions. ' +
      'Does NOT delete any business data. TI only. Every action is audit-logged.',
  })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @ApiResponse({ status: 201, description: 'Access regenerated — all prior sessions revoked' })
  @ApiResponse({ status: 403, description: 'TI role required' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  regenerateAccess(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Request() req,
  ) {
    return this.accountsService.regenerateAccess(accountId, req.user);
  }

  @Get(':accountId/audit')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({ summary: 'Get audit log', description: 'List all audited changes for an account — RP or TI only' })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Audit log entries' })
  getAuditLogs(@Param('accountId', ParseUUIDPipe) accountId: string) {
    return this.accountsService.getAuditLogs(accountId);
  }
}
