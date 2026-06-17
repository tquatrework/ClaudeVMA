import { Module } from '@nestjs/common';
import { InternalController } from './internal.controller';
import { PaymentsModule } from '../payments/payments.module';
import { InternalSecretGuard } from '../common/guards/internal-secret.guard';

@Module({
  imports: [PaymentsModule],
  controllers: [InternalController],
  providers: [InternalSecretGuard],
})
export class InternalModule {}
