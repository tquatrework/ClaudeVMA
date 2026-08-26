import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { SettingsController } from './settings.controller';
import { PedagogicalLogSettingsService } from './settings.service';
import { PedagogicalLogSettings } from './entities/pedagogical-log-settings.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [TypeOrmModule.forFeature([PedagogicalLogSettings]), JwtModule.register({})],
  controllers: [SettingsController],
  providers: [PedagogicalLogSettingsService, JwtAuthGuard, RolesGuard],
  exports: [PedagogicalLogSettingsService],
})
export class SettingsModule {}
