import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotebookEntry } from './entities/notebook-entry.entity';
import { CreateNotebookEntryDto } from './dto/create-notebook-entry.dto';
import { FindNotebookQueryDto } from './dto/find-notebook-query.dto';

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
 *
 * Spécification fonctionnelle réelle — notes rapides immuables (docs/
 * architecture.md, arbitrage du 2026-08-27) : une entrée est une « pensée
 * instantanée » horodatée automatiquement (`createdAt`), jamais éditée après
 * coup. Elle se supprime et se réécrit si besoin, elle ne se modifie jamais
 * — d'où l'absence délibérée d'une méthode `update()`.
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
   * Get the notebook entries belonging to the authenticated user, optionally
   * filtered by a `createdAt` date range (`from`/`to`) and/or a free-text
   * search on `content` (`q`). Sans filtre, retourne tout le carnet
   * (comportement inchangé) — les pensées instantanées se retrouvent par
   * recherche, pas par simple défilement, mais rien n'impose de chercher.
   */
  async findAll(callerId: string, query?: FindNotebookQueryDto): Promise<NotebookEntry[]> {
    const qb = this.notebookEntryRepository
      .createQueryBuilder('entry')
      .where('entry.ownerId = :ownerId', { ownerId: callerId });

    if (query?.from) {
      qb.andWhere('DATE(entry.createdAt) >= :from', { from: query.from });
    }
    if (query?.to) {
      qb.andWhere('DATE(entry.createdAt) <= :to', { to: query.to });
    }
    if (query?.q) {
      qb.andWhere('entry.content ILIKE :q', { q: `%${query.q}%` });
    }

    return qb.orderBy('entry.createdAt', 'DESC').getMany();
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
