import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ExerciseAttemptsController } from './exercise-attempts.controller';
import { ExerciseAttemptsService } from './exercise-attempts.service';
import { ExerciseStructureClientService } from './exercise-structure-client.service';
import { ExerciseSolutionClientService } from './exercise-solution-client.service';
import { ExerciseAttempt } from './entities/exercise-attempt.entity';
import { ExerciseAttemptPart } from './entities/exercise-attempt-part.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ExerciseAttempt, ExerciseAttemptPart]),
    JwtModule.register({}),
  ],
  controllers: [ExerciseAttemptsController],
  providers: [
    ExerciseAttemptsService,
    ExerciseStructureClientService,
    ExerciseSolutionClientService,
  ],
  exports: [ExerciseAttemptsService],
})
export class ExerciseAttemptsModule {}
