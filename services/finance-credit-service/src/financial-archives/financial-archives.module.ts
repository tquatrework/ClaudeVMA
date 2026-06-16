import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { FinancialArchivesController } from './financial-archives.controller';
import { FinancialArchivesService } from './financial-archives.service';
import { FinancialArchiveItem } from './entities/financial-archive-item.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinancialArchiveItem]),
    JwtModule.register({}),
  ],
  controllers: [FinancialArchivesController],
  providers: [FinancialArchivesService, JwtAuthGuard, RolesGuard],
  exports: [FinancialArchivesService],
})
export class FinancialArchivesModule {}
