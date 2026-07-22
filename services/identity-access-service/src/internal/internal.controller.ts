import { Body, Controller, Get, Param, Post, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AccountsService } from '../accounts/accounts.service';
import { CreateAccountDto } from '../accounts/dto/create-account.dto';
import { InternalGuard } from './internal.guard';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { CreateAccountInternalResponseDto } from './dto/create-account-response.dto';

type ListAccountsResult = Awaited<ReturnType<AccountsService['listAccounts']>>;
type FindByLoginIdentifierResult = Awaited<ReturnType<AccountsService['findByLoginIdentifier']>>;
type FindByUserIdResult = Awaited<ReturnType<AccountsService['findByUserId']>>;

@ApiExcludeController()
@UseGuards(InternalGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('create-account')
  async createAccount(@Body() dto: CreateAccountDto): Promise<CreateAccountInternalResponseDto> {
    const account = await this.accountsService.createAccount(dto);
    return { accountId: account.id, loginIdentifier: account.loginIdentifier, email: account.email, role: account.role };
  }

  @Get('accounts')
  listAccounts(@Query() query: ListAccountsQueryDto): Promise<ListAccountsResult> {
    return this.accountsService.listAccounts(query.role);
  }

  @Get('accounts/by-login-identifier')
  findByLoginIdentifier(@Query('loginIdentifier') loginIdentifier: string): Promise<FindByLoginIdentifierResult> {
    return this.accountsService.findByLoginIdentifier(loginIdentifier);
  }

  @Get('accounts/by-user-id/:userId')
  findByUserId(@Param('userId', ParseUUIDPipe) userId: string): Promise<FindByUserIdResult> {
    return this.accountsService.findByUserId(userId);
  }
}
