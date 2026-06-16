import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { FinancialProfilesController } from './financial-profiles.controller';
import { FinancialProfilesService } from './financial-profiles.service';
import { FinancialProfile } from './entities/financial-profile.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([FinancialProfile]),
    JwtModule.register({}),
  ],
  controllers: [FinancialProfilesController],
  providers: [FinancialProfilesService, JwtAuthGuard, RolesGuard],
  exports: [FinancialProfilesService],
})
export class FinancialProfilesModule {}
