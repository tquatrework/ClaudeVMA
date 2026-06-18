import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ForumsController } from './forums.controller';
import { ForumsService } from './forums.service';
import { Forum } from './entities/forum.entity';
import { ForumComment } from './entities/forum-comment.entity';
import { ForumExclusion } from './entities/forum-exclusion.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Forum, ForumComment, ForumExclusion]),
    JwtModule.register({}),
  ],
  controllers: [ForumsController],
  providers: [ForumsService],
  exports: [ForumsService],
})
export class ForumsModule {}
