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

/**
 * Carnet personnel — un carnet strictement privé par utilisateur authentifié,
 * quel que soit son rôle (élève, formateur, animateur pédagogique, et tout
 * rôle futur). Généralisé le 2026-08-27 (docs/architecture.md).
 *
 * Il n'existe qu'un seul chemin d'accès : l'utilisateur authentifié lit et
 * écrit SON PROPRE carnet (`ownerId = callerId`). Aucun paramètre de chemin
 * ne désigne un titulaire — contrairement à l'ancienne route
 * `students/:studentId/notebook`, il est désormais structurellement
 * impossible de construire une URL pointant vers le carnet d'autrui.
 *
 * Aucune exception : ni une relation métier (parent, formateur, AP, RP), ni
 * un rôle administratif (RP, AF, TI, y compris l'ancien accès TI "incident")
 * n'ouvre de droit sur le carnet d'un tiers. C'est la seule exception totale
 * à la règle "les administrateurs voient tout" du projet.
 */
@Injectable()
export class NotebookService {
  constructor(
    @InjectRepository(NotebookEntry)
    private readonly notebookEntryRepository: Repository<NotebookEntry>,
  ) {}

  /**
   * Create a notebook entry for the authenticated user, in their own notebook.
   */
  async create(
    dto: CreateNotebookEntryDto,
    callerId: string,
  ): Promise<NotebookEntry> {
    const entry = this.notebookEntryRepository.create({ ...dto, ownerId: callerId });
    return this.notebookEntryRepository.save(entry);
  }

  /**
   * Get all notebook entries belonging to the authenticated user.
   */
  async findAll(callerId: string): Promise<NotebookEntry[]> {
    return this.notebookEntryRepository.find({
      where: { ownerId: callerId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get a single notebook entry. Only the owner can access it.
   */
  async findOne(id: string, callerId: string): Promise<NotebookEntry> {
    const entry = await this.notebookEntryRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Notebook entry ${id} not found`);
    this.assertIsOwner(entry, callerId);
    return entry;
  }

  /**
   * Update a notebook entry. Only the owner can update.
   */
  async update(
    id: string,
    dto: UpdateNotebookEntryDto,
    callerId: string,
  ): Promise<NotebookEntry> {
    const entry = await this.notebookEntryRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Notebook entry ${id} not found`);
    this.assertIsOwner(entry, callerId);

    Object.assign(entry, dto);
    return this.notebookEntryRepository.save(entry);
  }

  /**
   * Delete a notebook entry. Only the owner can delete.
   */
  async remove(id: string, callerId: string): Promise<void> {
    const entry = await this.notebookEntryRepository.findOne({ where: { id } });
    if (!entry) throw new NotFoundException(`Notebook entry ${id} not found`);
    this.assertIsOwner(entry, callerId);
    await this.notebookEntryRepository.remove(entry);
  }

  /**
   * On ne révèle jamais qu'une entrée appartenant à un tiers existe : un
   * appelant qui n'est pas le titulaire reçoit exactement le même 403 qu'un
   * appelant qui cible un id inexistant reçoit un 404 — jamais d'indice
   * distinguant les deux cas côté client.
   */
  private assertIsOwner(entry: NotebookEntry, callerId: string): void {
    if (entry.ownerId !== callerId) {
      throw new ForbiddenException(
        'Le carnet personnel est strictement privé — réservé à son titulaire',
      );
    }
  }
}
