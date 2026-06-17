import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { LegalTemplate } from './entities/legal-template.entity';
import { LegalTemplatesController } from './legal-templates.controller';
import { LegalTemplatesService } from './legal-templates.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([LegalTemplate]),
    JwtModule.register({}),
  ],
  controllers: [LegalTemplatesController],
  providers: [LegalTemplatesService, JwtAuthGuard, RolesGuard],
  exports: [LegalTemplatesService],
})
export class LegalTemplatesModule {}
