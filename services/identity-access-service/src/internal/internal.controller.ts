import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AccountsService } from '../accounts/accounts.service';
import { CreateAccountDto } from '../accounts/dto/create-account.dto';
import { InternalGuard } from './internal.guard';

@ApiExcludeController()
@UseGuards(InternalGuard)
@Controller('internal')
export class InternalController {
  constructor(private readonly accountsService: AccountsService) {}

  @Post('create-account')
  async createAccount(@Body() dto: CreateAccountDto) {
    const account = await this.accountsService.createAccount(dto);
    return { accountId: account.id, email: account.email, role: account.role };
  }
}
