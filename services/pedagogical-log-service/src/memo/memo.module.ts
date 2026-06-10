import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { MemoController } from './memo.controller';
import { MemoService } from './memo.service';
import { Memo } from './entities/memo.entity';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Memo]),
    JwtModule.register({}),
  ],
  controllers: [MemoController],
  providers: [MemoService, JwtAuthGuard, RolesGuard],
  exports: [MemoService],
})
export class MemoModule {}
