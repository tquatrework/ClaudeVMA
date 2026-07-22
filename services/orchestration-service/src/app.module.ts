import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { WorkflowModule } from './workflow/workflow.module';
import { CommandModule } from './command/command.module';
import { EventModule } from './event/event.module';
import { CallbackModule } from './callback/callback.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { CorrelationTraceModule } from './correlation/correlation-trace.module';
import { CorrelationMiddleware } from './common/middleware/correlation.middleware';
import { SecurityModule } from './security/security.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get('DB_USER', 'postgres'),
        password: config.getOrThrow<string>('DB_PASSWORD'),
        database: config.get('DB_NAME', 'orchestration'),
        autoLoadEntities: true,
        synchronize: config.get('NODE_ENV') === 'test',
        logging: config.get('NODE_ENV') === 'development',
      }),
    }),
    SecurityModule,
    HealthModule,
    IdempotencyModule,
    CorrelationTraceModule,
    WorkflowModule,
    CommandModule,
    EventModule,
    CallbackModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
