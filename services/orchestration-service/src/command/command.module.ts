import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationCommand } from './entities/integration-command.entity';
import { CommandService } from './command.service';
import { CommandController } from './command.controller';
import { HttpClientModule } from '../http-client/http-client.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationCommand]),
    HttpClientModule,
    IdempotencyModule,
  ],
  providers: [CommandService],
  controllers: [CommandController],
})
export class CommandModule {}
