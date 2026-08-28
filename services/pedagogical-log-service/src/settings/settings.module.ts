import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { SettingsController } from './settings.controller';
import { PedagogicalLogSettingsService } from './settings.service';
import { PedagogicalLogSettings } from './entities/pedagogical-log-settings.entity';
import { NotebookAccessSettingsService } from './notebook-access-settings.service';
import { NotebookAccessSettings } from './entities/notebook-access-settings.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([PedagogicalLogSettings, NotebookAccessSettings]),
    JwtModule.register({}),
  ],
  controllers: [SettingsController],
  providers: [PedagogicalLogSettingsService, NotebookAccessSettingsService, JwtAuthGuard, RolesGuard],
  exports: [PedagogicalLogSettingsService, NotebookAccessSettingsService],
})
export class SettingsModule {}
