import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PedagogicalLogController } from './pedagogical-log.controller';
import { PedagogicalLogService } from './pedagogical-log.service';
import { PedagogicalLog } from './entities/pedagogical-log.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([PedagogicalLog]),
    JwtModule.register({}),
  ],
  controllers: [PedagogicalLogController],
  providers: [PedagogicalLogService, JwtAuthGuard, RolesGuard],
  exports: [PedagogicalLogService],
})
export class PedagogicalLogModule {}
