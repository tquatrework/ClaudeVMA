import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PedagogicalLog } from './entities/pedagogical-log.entity';
import { CreateLogDto } from './dto/create-log.dto';

@Injectable()
export class PedagogicalLogService {
  constructor(
    @InjectRepository(PedagogicalLog) private readonly repo: Repository<PedagogicalLog>,
  ) {}

  create(dto: CreateLogDto) {
    return this.repo.save(this.repo.create(dto));
  }

  findByStudent(studentId: string) {
    return this.repo.find({ where: { studentId }, order: { createdAt: 'DESC' } });
  }

  findBySession(sessionId: string) {
    return this.repo.find({ where: { sessionId }, order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const log = await this.repo.findOne({ where: { id } });
    if (!log) throw new NotFoundException(`Log ${id} not found`);
    return log;
  }
}
