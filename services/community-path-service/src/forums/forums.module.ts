import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ForumsController } from './forums.controller';
import { ForumsService } from './forums.service';
import { ForumImageStorageService } from './services/forum-image-storage.service';
import { ForumTopicsBootstrapService } from './services/forum-topics-bootstrap.service';
import { ProfileServiceClient } from '../common/clients/profile-service.client';
import { Forum } from './entities/forum.entity';
import { ForumTopic } from './entities/forum-topic.entity';
import { ForumComment } from './entities/forum-comment.entity';
import { ForumExclusion } from './entities/forum-exclusion.entity';
import { ForumCharterSetting } from './entities/forum-charter-setting.entity';
import { ForumCharterAcceptance } from './entities/forum-charter-acceptance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Forum,
      ForumTopic,
      ForumComment,
      ForumExclusion,
      ForumCharterSetting,
      ForumCharterAcceptance,
    ]),
    JwtModule.register({}),
  ],
  controllers: [ForumsController],
  providers: [ForumsService, ForumImageStorageService, ForumTopicsBootstrapService, ProfileServiceClient],
  exports: [ForumsService],
})
export class ForumsModule {}
