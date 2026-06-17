import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ArchiveModule } from './archive/archive.module';
import { HealthModule } from './health/health.module';
import { InternalModule } from './internal/internal.module';
import { ArchiveItem } from './archive/entities/archive-item.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        url: config.get<string>('DATABASE_URL'),
        entities: [ArchiveItem],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    ArchiveModule,
    HealthModule,
    InternalModule,
  ],
})
export class AppModule {}
