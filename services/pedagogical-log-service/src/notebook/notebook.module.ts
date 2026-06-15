import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { NotebookController } from './notebook.controller';
import { NotebookService } from './notebook.service';
import { NotebookEntry } from './entities/notebook-entry.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([NotebookEntry]),
    JwtModule.register({}),
  ],
  controllers: [NotebookController],
  providers: [NotebookService, JwtAuthGuard, RolesGuard],
  exports: [NotebookService],
})
export class NotebookModule {}
