import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ValidationsController } from './validations.controller';
import { ValidationsService } from './validations.service';
import { ContentValidation } from './entities/content-validation.entity';
import { Exercise } from '../exercises/entities/exercise.entity';
import { Evaluation } from '../evaluations/entities/evaluation.entity';
import { Tutorial } from '../tutorials/entities/tutorial.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentValidation, Exercise, Evaluation, Tutorial]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ValidationsController],
  providers: [ValidationsService],
  exports: [ValidationsService],
})
export class ValidationsModule {}
