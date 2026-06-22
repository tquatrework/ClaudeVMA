import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ActivityLog } from './entities/activity-log.entity';
import { TechnicalLog } from './entities/technical-log.entity';
import { VisibilityOverride } from './entities/visibility-override.entity';
import { SiteMetadata } from './entities/site-metadata.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ActivityLog, TechnicalLog, VisibilityOverride, SiteMetadata]),
    JwtModule.register({}),
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
