import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ChapterController } from './chapter.controller';
import { MemoController } from './memo.controller';
import { ChapterService } from './chapter.service';
import { MemoService } from './memo.service';
import { Chapter } from './entities/chapter.entity';
import { Memo } from './entities/memo.entity';
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
 *
 * Chapter et Memo sont enregistrés ici car ChapterService en a besoin :
 * - ChapterRepository (index 0) : opérations CRUD sur les chapitres
 * - MemoRepository (index 1) : passage chapterId → null à la suppression
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Chapter, Memo, MemoChapter, MemoItem]),
    JwtModule.register({}),
  ],
  controllers: [ChapterController, MemoController],
  providers: [ChapterService, MemoService, JwtAuthGuard, RolesGuard],
  exports: [MemoService, ChapterService],
})
export class MemoModule {}
