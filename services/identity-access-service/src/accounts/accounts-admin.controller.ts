import { Controller, Get, Put, Patch, Post, Param, Body, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AccountsService } from './accounts.service';
import { UpdateRolesDto } from './dto/update-roles.dto';
import { UpdateAccountStatusDto } from './dto/update-account-status.dto';
import { AccountResponseDto } from './dto/account-response.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { UserRole } from '../auth/entities/user.entity';
import { AuditLog } from './entities/audit-log.entity';

/**
 * Racine de ressource `accounts` — volet administration (RP/TI/AdministrateurFinancier) :
 * consultation, rôles, validation, suspension, statut, régénération d'accès et audit.
 * Le volet self-service (inscription, mise à jour de son propre compte) est sur
 * AccountsController, dans le même module.
 */
@ApiTags('accounts')
@Controller('accounts')
export class AccountsAdminController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get(':accountId')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.TECHNICIEN_INFORMATIQUE, UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.ADMINISTRATEUR_FINANCIER)
  @ApiOperation({ summary: 'Get account', description: 'Retrieve account details — TI, RP, AdministrateurFinancier only' })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Account details' })
  @ApiResponse({ status: 404, description: 'Account not found' })
  getAccount(@Param('accountId', ParseUUIDPipe) accountId: string): Promise<AccountResponseDto> {
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
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AccountResponseDto> {
    return this.accountsService.updateRoles(accountId, dto, actor);
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
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AccountResponseDto> {
    return this.accountsService.validateAccount(accountId, actor);
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
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AccountResponseDto> {
    return this.accountsService.suspendAccount(accountId, actor);
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
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<AccountResponseDto> {
    return this.accountsService.updateAccountStatus(accountId, dto, actor);
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
    @CurrentUser() actor: AuthenticatedUser,
  ): Promise<MessageResponseDto> {
    return this.accountsService.regenerateAccess(accountId, actor);
  }

  @Get(':accountId/audit')
  @ApiBearerAuth()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(UserRole.RESPONSABLE_PEDAGOGIQUE, UserRole.TECHNICIEN_INFORMATIQUE)
  @ApiOperation({ summary: 'Get audit log', description: 'List all audited changes for an account — RP or TI only' })
  @ApiParam({ name: 'accountId', description: 'Account UUID' })
  @ApiResponse({ status: 200, description: 'Audit log entries' })
  getAuditLogs(@Param('accountId', ParseUUIDPipe) accountId: string): Promise<AuditLog[]> {
    return this.accountsService.getAuditLogs(accountId);
  }
}
