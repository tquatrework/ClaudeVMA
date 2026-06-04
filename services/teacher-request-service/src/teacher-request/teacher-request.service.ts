import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TeacherRequest } from './entities/teacher-request.entity';
import { CreateRequestDto } from './dto/create-request.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

@Injectable()
export class TeacherRequestService {
  constructor(
    @InjectRepository(TeacherRequest) private readonly repo: Repository<TeacherRequest>,
  ) {}

  create(dto: CreateRequestDto) {
    return this.repo.save(this.repo.create(dto));
  }

  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  async findOne(id: string) {
    const req = await this.repo.findOne({ where: { id } });
    if (!req) throw new NotFoundException(`Request ${id} not found`);
    return req;
  }

  async updateStatus(id: string, dto: UpdateStatusDto) {
    const req = await this.findOne(id);
    return this.repo.save({ ...req, status: dto.status });
  }

  async remove(id: string) {
    const req = await this.findOne(id);
    await this.repo.remove(req);
    return { deleted: true };
  }
}
