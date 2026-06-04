import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PedagogicalLogController } from './pedagogical-log.controller';
import { PedagogicalLogService } from './pedagogical-log.service';
import { PedagogicalLog } from './entities/pedagogical-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PedagogicalLog])],
  controllers: [PedagogicalLogController],
  providers: [PedagogicalLogService],
})
export class PedagogicalLogModule {}
