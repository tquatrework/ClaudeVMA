import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { HealthModule } from './health/health.module';
import { ActivityLog } from './admin/entities/activity-log.entity';
import { TechnicalLog } from './admin/entities/technical-log.entity';
import { VisibilityOverride } from './admin/entities/visibility-override.entity';
import { SiteMetadata } from './admin/entities/site-metadata.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [ActivityLog, TechnicalLog, VisibilityOverride, SiteMetadata],
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
      inject: [ConfigService],
    }),
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
