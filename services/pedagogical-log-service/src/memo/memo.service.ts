import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Memo } from './entities/memo.entity';
import { CreateMemoDto } from './dto/create-memo.dto';
import { UpdateMemoDto } from './dto/update-memo.dto';

/**
 * Rôles autorisés à lire un mémo en dehors du propriétaire.
 * Ces rôles n'ont AUCUN droit d'écriture (PLOG-BR-003).
 */
const READ_ONLY_ROLES_FOR_MEMO = [
  'formateur',
  'responsable_pedagogique',
  'animateur_pedagogique',
];

@Injectable()
export class MemoService {
  constructor(
    @InjectRepository(Memo)
    private readonly memoRepository: Repository<Memo>,
  ) {}

  /**
   * Créer un mémo pour l'élève connecté.
   * Seul l'élève peut créer (PLOG-BR-003).
   */
  create(dto: CreateMemoDto, studentId: string): Promise<Memo> {
    const memo = this.memoRepository.create({ ...dto, studentId });
    return this.memoRepository.save(memo);
  }

  /**
   * Lister les mémos de l'élève connecté (filtre par studentId = userId du JWT).
   * Seul l'élève voit ses propres mémos via cette route.
   */
  findByStudent(studentId: string): Promise<Memo[]> {
    return this.memoRepository.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Lire un mémo par ID.
   * - L'élève propriétaire peut toujours lire.
   * - Les formateurs liés, RP et AP peuvent lire en lecture seule.
   * - Tout autre rôle (parent, TI, AF) est refusé.
   */
  async findOne(id: string, callerId: string, callerRole: string): Promise<Memo> {
    const memo = await this.memoRepository.findOne({ where: { id } });
    if (!memo) throw new NotFoundException(`Memo ${id} not found`);

    const isOwner = memo.studentId === callerId;
    const isReadOnlyAllowed = READ_ONLY_ROLES_FOR_MEMO.includes(callerRole);

    if (!isOwner && !isReadOnlyAllowed) {
      throw new ForbiddenException('Access to this memo is not allowed');
    }
    return memo;
  }

  /**
   * Modifier un mémo.
   * Seul l'élève propriétaire peut modifier (PLOG-BR-003).
   */
  async update(id: string, dto: UpdateMemoDto, callerId: string): Promise<Memo> {
    const memo = await this.memoRepository.findOne({ where: { id } });
    if (!memo) throw new NotFoundException(`Memo ${id} not found`);

    if (memo.studentId !== callerId) {
      throw new ForbiddenException('Only the student owner can update this memo');
    }

    Object.assign(memo, dto);
    return this.memoRepository.save(memo);
  }

  /**
   * Supprimer un mémo.
   * Seul l'élève propriétaire peut supprimer (PLOG-BR-003).
   */
  async remove(id: string, callerId: string): Promise<void> {
    const memo = await this.memoRepository.findOne({ where: { id } });
    if (!memo) throw new NotFoundException(`Memo ${id} not found`);

    if (memo.studentId !== callerId) {
      throw new ForbiddenException('Only the student owner can delete this memo');
    }
    await this.memoRepository.remove(memo);
  }
}
