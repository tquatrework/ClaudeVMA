import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ContentsController } from './contents.controller';
import { ContentsService } from './contents.service';
import { ContentComment } from './entities/content-comment.entity';
import { ContentRating } from './entities/content-rating.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ContentComment, ContentRating]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ContentsController],
  providers: [ContentsService],
  exports: [ContentsService],
})
export class ContentsModule {}
