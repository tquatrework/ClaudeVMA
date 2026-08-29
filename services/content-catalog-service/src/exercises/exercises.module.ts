import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExercisesController } from './exercises.controller';
import { InternalExercisesController } from './internal-exercises.controller';
import { ExercisesService } from './exercises.service';
import { Exercise } from './entities/exercise.entity';
import { ExercisePart } from './entities/exercise-part.entity';
import { ExerciseSolution } from './entities/exercise-solution.entity';
import { ExerciseContentItem } from './entities/exercise-content-item.entity';
import { ExerciseImageStorageService } from './exercise-image-storage.service';
import { ExerciseImageTranscoder } from './exercise-image-transcoder';
import { ProfileClientModule } from '../common/clients/profile-client.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Exercise, ExercisePart, ExerciseSolution, ExerciseContentItem]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    ProfileClientModule,
  ],
  controllers: [ExercisesController, InternalExercisesController],
  providers: [ExercisesService, ExerciseImageStorageService, ExerciseImageTranscoder],
  exports: [ExercisesService],
})
export class ExercisesModule {}
