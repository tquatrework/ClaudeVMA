import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { AttachmentStorageService } from './attachment-storage.service';
import { PedagogicalLogAttachment } from './entities/pedagogical-log-attachment.entity';
import { PedagogicalLogModule } from '../pedagogical-log/pedagogical-log.module';
import { SettingsModule } from '../settings/settings.module';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([PedagogicalLogAttachment]),
    JwtModule.register({}),
    PedagogicalLogModule,
    SettingsModule,
  ],
  controllers: [AttachmentsController],
  providers: [AttachmentsService, AttachmentStorageService, JwtAuthGuard, RolesGuard],
})
export class AttachmentsModule {}
