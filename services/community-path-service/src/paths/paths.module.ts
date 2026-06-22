import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PathsController, PathEnrollmentsController } from './paths.controller';
import { PathsService } from './paths.service';
import { LearningPath } from './entities/learning-path.entity';
import { PathStep } from './entities/path-step.entity';
import { PathEnrollment } from './entities/path-enrollment.entity';
import { PathProgress } from './entities/path-progress.entity';
import { Certificate } from './entities/certificate.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([LearningPath, PathStep, PathEnrollment, PathProgress, Certificate]),
    JwtModule.register({}),
  ],
  controllers: [PathsController, PathEnrollmentsController],
  providers: [PathsService],
  exports: [PathsService],
})
export class PathsModule {}
