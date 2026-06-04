import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CalendarSession } from './entities/calendar-session.entity';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class CalendarService {
  constructor(
    @InjectRepository(CalendarSession) private readonly repo: Repository<CalendarSession>,
  ) {}

  create(dto: CreateSessionDto) {
    return this.repo.save(this.repo.create(dto));
  }

  findAll() {
    return this.repo.find({ order: { startTime: 'ASC' } });
  }

  findByTeacher(teacherId: string) {
    return this.repo.find({ where: { teacherId }, order: { startTime: 'ASC' } });
  }

  findByStudent(studentId: string) {
    return this.repo.find({ where: { studentId }, order: { startTime: 'ASC' } });
  }

  async findOne(id: string) {
    const session = await this.repo.findOne({ where: { id } });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  async update(id: string, dto: Partial<CreateSessionDto>) {
    const session = await this.findOne(id);
    return this.repo.save({ ...session, ...dto });
  }

  async remove(id: string) {
    const session = await this.findOne(id);
    await this.repo.remove(session);
    return { deleted: true };
  }
}
