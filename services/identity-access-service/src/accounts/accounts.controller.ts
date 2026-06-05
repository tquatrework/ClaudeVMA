import {
  Controller,
  Post,
  Get,
  Put,
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
