import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ArchiveItem } from './entities/archive-item.entity';
import { ArchiveController, ArchiveDocumentController } from './archive.controller';
import { ArchiveService } from './archive.service';
import { ProfileRelationsClient } from '../common/clients/profile-relations.client';

@Module({
  imports: [
    TypeOrmModule.forFeature([ArchiveItem]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [ArchiveController, ArchiveDocumentController],
  providers: [ArchiveService, ProfileRelationsClient],
  exports: [ArchiveService],
})
export class ArchiveModule {}
