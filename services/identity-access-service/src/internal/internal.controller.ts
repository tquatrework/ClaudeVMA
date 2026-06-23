import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AccountsService } from '../accounts/accounts.service';
import { CreateAccountDto } from '../accounts/dto/create-account.dto';
import { UserRole } from '../auth/entities/user.entity';
import { InternalGuard } from './internal.guard';

@ApiExcludeController()
@UseGuards(InternalGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('create-account')
  async createAccount(@Body() dto: CreateAccountDto) {
    const account = await this.accountsService.createAccount(dto);
    return { accountId: account.id, loginIdentifier: account.loginIdentifier, email: account.email, role: account.role };
  }

  @Get('accounts')
  async listAccounts(@Query('role') roleFilter?: UserRole) {
    return this.accountsService.listAccounts(roleFilter);
  }

  @Get('accounts/by-login-identifier')
  async findByLoginIdentifier(@Query('loginIdentifier') loginIdentifier: string) {
    return this.accountsService.findByLoginIdentifier(loginIdentifier);
  }
}
