import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PedagogicalLogController } from './pedagogical-log.controller';
import { SpecialPageController } from './special-page.controller';
import { PedagogicalLogService } from './pedagogical-log.service';
import { EmptyEntryReminderService } from './empty-entry-reminder.service';
import { PedagogicalLog } from './entities/pedagogical-log.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClientsModule } from '../common/clients/clients.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PedagogicalLog]),
    JwtModule.register({}),
    ClientsModule,
  ],
  controllers: [PedagogicalLogController, SpecialPageController],
  providers: [PedagogicalLogService, EmptyEntryReminderService, JwtAuthGuard, RolesGuard],
  exports: [PedagogicalLogService],
})
export class PedagogicalLogModule {}
