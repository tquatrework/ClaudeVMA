import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TutorialsController } from './tutorials.controller';
import { TutorialsService } from './tutorials.service';
import { Tutorial } from './entities/tutorial.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tutorial]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [TutorialsController],
  providers: [TutorialsService],
  exports: [TutorialsService],
})
export class TutorialsModule {}
