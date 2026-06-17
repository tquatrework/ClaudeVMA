import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';
import { Exercise } from './entities/exercise.entity';
import { ExercisePart } from './entities/exercise-part.entity';
import { ExerciseAnswer } from './entities/exercise-answer.entity';
import { ExerciseCorrection } from './entities/exercise-correction.entity';
import { ExerciseSolution } from './entities/exercise-solution.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Exercise,
      ExercisePart,
      ExerciseAnswer,
      ExerciseCorrection,
      ExerciseSolution,
    ]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ExercisesController],
  providers: [ExercisesService],
  exports: [ExercisesService],
})
export class ExercisesModule {}
