import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { MemoController } from './memo.controller';
import { MemoService } from './memo.service';
import { MemoImageStorageService } from './memo-image-storage.service';
import { MemoChapter } from './entities/memo-chapter.entity';
import { MemoItem } from './entities/memo-item.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { ClientsModule } from '../common/clients/clients.module';

/**
 * MemoModule — Mémo élève (chapitres et items), chantier feat/memo-formules.
 *
 * L'ancien `ChapterController`/`ChapterService` (entités `Chapter`/`Memo`,
 * modèle concurrent jamais enregistré dans `TypeOrmModule.forRootAsync` de
 * `app.module.ts`, donc jamais fonctionnel en production — `500`
 * systématique, et gagnant la collision de route sur `POST/GET
 * memos/chapters(/:id)` par simple ordre de déclaration) sont retirés par ce
 * chantier. `MemoController`/`MemoService` (entités `MemoChapter`/`MemoItem`)
 * sont désormais la seule implémentation, complétée du CRUD manquant et de
 * la lecture pour les tiers reliés (formateur, RP/AP, parent financeur) via
 * `ClientsModule` (`ProfileRelationsClient`, même mécanisme que le cahier de
 * texte).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([MemoChapter, MemoItem]),
    JwtModule.register({}),
    ClientsModule,
  ],
  controllers: [MemoController],
  providers: [MemoService, MemoImageStorageService, JwtAuthGuard, RolesGuard],
  exports: [MemoService],
})
export class MemoModule {}
