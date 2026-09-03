import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ExercisesController } from './exercises.controller';
import { InternalExercisesController } from './internal-exercises.controller';
import { ExercisesService } from './exercises.service';
import { ExerciseImportService } from './exercise-import.service';
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
  providers: [ExercisesService, ExerciseImportService, ExerciseImageStorageService, ExerciseImageTranscoder],
  // ExerciseImageStorageService/ExerciseImageTranscoder exportés depuis le
  // 2026-09-03 : TutorialsModule les réutilise tels quels pour les blocs
  // image du Tutoriel (arbitrage "Refonte des Tutos/Vidéos", point 4 —
  // "réutilise le même mécanisme d'image de premier niveau que l'Exercice"),
  // même volume Docker, même transcodeur, plutôt que d'en écrire un second.
  exports: [ExercisesService, ExerciseImageStorageService, ExerciseImageTranscoder],
})
export class ExercisesModule {}
