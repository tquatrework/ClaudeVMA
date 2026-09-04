import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ForumsController } from './forums.controller';
import { ForumsService } from './forums.service';
import { ForumImageStorageService } from './services/forum-image-storage.service';
import { Forum } from './entities/forum.entity';
import { ForumComment } from './entities/forum-comment.entity';
import { ForumExclusion } from './entities/forum-exclusion.entity';
import { ForumCharterSetting } from './entities/forum-charter-setting.entity';
import { ForumCharterAcceptance } from './entities/forum-charter-acceptance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Forum,
      ForumComment,
      ForumExclusion,
      ForumCharterSetting,
      ForumCharterAcceptance,
    ]),
    JwtModule.register({}),
  ],
  controllers: [ForumsController],
  providers: [ForumsService, ForumImageStorageService],
  exports: [ForumsService],
})
export class ForumsModule {}
