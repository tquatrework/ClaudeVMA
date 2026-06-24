import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ChapterController } from './chapter.controller';
import { MemoController } from './memo.controller';
import { ChapterService } from './chapter.service';
import { MemoService } from './memo.service';
import { MemoChapter } from './entities/memo-chapter.entity';
import { MemoItem } from './entities/memo-item.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

/**
 * MemoModule — Chapitres et mémos élève
 *
 * IMPORTANT: ChapterController est déclaré AVANT MemoController pour que
 * la route GET /memos/chapters ne soit pas interceptée par GET /memos/:id.
 * NestJS matche les routes dans l'ordre de déclaration des contrôleurs.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MemoChapter, MemoItem]),
    JwtModule.register({}),
  ],
  controllers: [ChapterController, MemoController],
  providers: [ChapterService, MemoService, JwtAuthGuard, RolesGuard],
  exports: [MemoService, ChapterService],
})
export class MemoModule {}
