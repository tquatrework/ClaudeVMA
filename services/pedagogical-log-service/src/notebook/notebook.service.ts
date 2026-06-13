import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotebookEntry } from './entities/notebook-entry.entity';
import { CreateNotebookEntryDto } from './dto/create-notebook-entry.dto';
import { UpdateNotebookEntryDto } from './dto/update-notebook-entry.dto';

@Injectable()
export class NotebookService {
  constructor(
    @InjectRepository(NotebookEntry)
    private readonly notebookEntryRepository: Repository<NotebookEntry>,
  ) {}

  /**
   * Create a notebook entry for the authenticated student.
   * PLOG-RA-001: only the student themselves can write in their notebook.
   */
  create(
    studentId: string,
    dto: CreateNotebookEntryDto,
    callerId: string,
  ): Promise<NotebookEntry> {
    this.assertIsOwner(studentId, callerId);
    const entry = this.notebookEntryRepository.create({ ...dto, studentId });
    return this.notebookEntryRepository.save(entry);
  }

  /**
   * Get all notebook entries for a student.
   * PLOG-FB-001 / PLOG-RA-001: only the student themselves can access their notebook.
   */
  findAll(studentId: string, callerId: string, callerRole: string): Promise<NotebookEntry[]> {
    // TI can access for technical incident resolution only
    if (callerRole === 'technicien_informatique') {
      return this.notebookEntryRepository.find({
        where: { studentId },
        order: { createdAt: 'DESC' },
      });
    }
    this.assertIsOwner(studentId, callerId);
    return this.notebookEntryRepository.find({
      where: { studentId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single notebook entry.
   * Only the student owner (or TI) can access.
   */
  async findOne(
    studentId: string,
    id: string,
    callerId: string,
    callerRole: string,
  ): Promise<NotebookEntry> {
    const entry = await this.notebookEntryRepository.findOne({ where: { id, studentId } });
    if (!entry) throw new NotFoundException(`Notebook entry ${id} not found`);

    if (callerRole !== 'technicien_informatique') {
      this.assertIsOwner(studentId, callerId);
    }
    return entry;
  }

  /**
   * Update a notebook entry. Only the student owner can update.
   */
  async update(
    studentId: string,
    id: string,
    dto: UpdateNotebookEntryDto,
    callerId: string,
  ): Promise<NotebookEntry> {
    this.assertIsOwner(studentId, callerId);
    const entry = await this.notebookEntryRepository.findOne({ where: { id, studentId } });
    if (!entry) throw new NotFoundException(`Notebook entry ${id} not found`);

    Object.assign(entry, dto);
    return this.notebookEntryRepository.save(entry);
  }

  /**
   * Delete a notebook entry. Only the student owner can delete.
   */
  async remove(studentId: string, id: string, callerId: string): Promise<void> {
    this.assertIsOwner(studentId, callerId);
    const entry = await this.notebookEntryRepository.findOne({ where: { id, studentId } });
    if (!entry) throw new NotFoundException(`Notebook entry ${id} not found`);
    await this.notebookEntryRepository.remove(entry);
  }

  private assertIsOwner(studentId: string, callerId: string): void {
    if (studentId !== callerId) {
      throw new ForbiddenException(
        'Le carnet personnel est réservé à l\'élève uniquement — PLOG-FB-001',
      );
    }
  }
}
