import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConsentsController } from './consents.controller';
import { ConsentsService } from './consents.service';
import { ConsentRecord } from './entities/consent-record.entity';
import { User } from '../auth/entities/user.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([ConsentRecord, User]), EventsModule],
  controllers: [ConsentsController],
  providers: [ConsentsService],
})
export class ConsentsModule {}
