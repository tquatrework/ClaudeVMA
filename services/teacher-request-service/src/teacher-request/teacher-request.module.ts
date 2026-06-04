import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TeacherRequestController } from './teacher-request.controller';
import { TeacherRequestService } from './teacher-request.service';
import { TeacherRequest } from './entities/teacher-request.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TeacherRequest])],
  controllers: [TeacherRequestController],
  providers: [TeacherRequestService],
})
export class TeacherRequestModule {}
