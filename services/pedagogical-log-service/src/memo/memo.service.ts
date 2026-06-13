import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Memo } from './entities/memo.entity';
import { CreateMemoDto } from './dto/create-memo.dto';

@Injectable()
export class MemoService {
  constructor(
    @InjectRepository(Memo)
    private readonly memoRepository: Repository<Memo>,
  ) {}

  create(dto: CreateMemoDto, authorId: string, authorRole: string): Promise<Memo> {
    const memo = this.memoRepository.create({ ...dto, authorId, authorRole });
    return this.memoRepository.save(memo);
  }

  findByAuthor(authorId: string): Promise<Memo[]> {
    return this.memoRepository.find({
      where: { authorId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string, callerId: string, callerRole: string): Promise<Memo> {
    const memo = await this.memoRepository.findOne({ where: { id } });
    if (!memo) throw new NotFoundException(`Memo ${id} not found`);

    const canRead =
      memo.authorId === callerId ||
      callerRole === 'responsable_pedagogique' ||
      callerRole === 'animateur_pedagogique' ||
      callerRole === 'technicien_informatique' ||
      callerRole === 'administrateur_financier';

    if (!canRead) {
      throw new ForbiddenException('Access to this memo is not allowed');
    }
    return memo;
  }

  async remove(id: string, callerId: string, callerRole: string): Promise<void> {
    const memo = await this.memoRepository.findOne({ where: { id } });
    if (!memo) throw new NotFoundException(`Memo ${id} not found`);

    const canDelete =
      memo.authorId === callerId ||
      callerRole === 'responsable_pedagogique' ||
      callerRole === 'technicien_informatique';

    if (!canDelete) {
      throw new ForbiddenException('Only the author or a RP/TI can delete a memo');
    }
    await this.memoRepository.remove(memo);
  }
}
