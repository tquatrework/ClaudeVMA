import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { IntegrationCommand } from './entities/integration-command.entity';
import { CommandService } from './command.service';
import { CommandController } from './command.controller';
import { HttpClientModule } from '../http-client/http-client.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([IntegrationCommand]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({ secret: config.get<string>('JWT_SECRET') }),
      inject: [ConfigService],
    }),
    HttpClientModule,
    IdempotencyModule,
  ],
  providers: [CommandService],
  controllers: [CommandController],
})
export class CommandModule {}
