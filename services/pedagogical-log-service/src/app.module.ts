import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PedagogicalLogModule } from './pedagogical-log/pedagogical-log.module';
import { HealthModule } from './health/health.module';
import { PedagogicalLog } from './pedagogical-log/entities/pedagogical-log.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [PedagogicalLog],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    PedagogicalLogModule,
    HealthModule,
  ],
})
export class AppModule {}
