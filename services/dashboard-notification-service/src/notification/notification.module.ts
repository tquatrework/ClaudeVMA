import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { Notification } from './entities/notification.entity';
import { SecurityModule } from '../common/security/security.module';
import { ClientsModule } from '../common/clients/clients.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), SecurityModule, ClientsModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
