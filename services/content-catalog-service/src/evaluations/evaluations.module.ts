import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { Evaluation } from './entities/evaluation.entity';
import { ExercisePart } from '../exercises/entities/exercise-part.entity';
import { ProfileClientModule } from '../common/clients/profile-client.module';

@Module({
  imports: [
    // ExercisePart importé directement (pas via ExercisesModule) pour
    // valider les identifiants de bloc question référencés par le barème
    // informatif (mode per_question) sans dépendance de module croisée —
    // même lecture seule que les autres validations de ce service.
    TypeOrmModule.forFeature([Evaluation, ExercisePart]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
    // Nécessaire pour ProfileRelationsClient (scoping AP animator_of_teacher
    // sur la lecture d'une évaluation en attente — arbitrage du 2026-09-02).
    ProfileClientModule,
  ],
  controllers: [EvaluationsController],
  providers: [EvaluationsService],
  exports: [EvaluationsService],
})
export class EvaluationsModule {}
