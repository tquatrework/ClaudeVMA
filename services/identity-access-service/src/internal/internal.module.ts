import { Module } from '@nestjs/common';
import { AccountsModule } from '../accounts/accounts.module';
import { InternalController } from './internal.controller';
import { InternalGuard } from './internal.guard';

@Module({
  imports: [AccountsModule],
  controllers: [InternalController],
  providers: [InternalGuard],
})
export class InternalModule {}
