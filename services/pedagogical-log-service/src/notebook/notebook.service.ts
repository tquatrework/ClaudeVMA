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
import { NotebookAccessSettingsService } from '../settings/notebook-access-settings.service';
import { NotebookAdminAccess } from '../settings/entities/notebook-access-settings.entity';
import { ProfileRelationsClient } from '../common/clients/profile-relations.client';
import { UserRole } from '../common/enums/user-role.enum';

/**
 * Nature de la relation `profile-service` ouvrant, si l'axe parental est
 * activé, la lecture du carnet d'un élève à son parent financeur (docs/
 * routes.md > profile-service, "Valeurs de kind"). Lien vérifié actif
 * (`endedAt IS NULL`) à chaque appel.
 */
const NOTEBOOK_PARENT_RELATION_KIND = 'finance_owner_of_student';

/**
 * Carnet personnel — un carnet strictement privé par utilisateur authentifié,
 * quel que soit son rôle (élève, formateur, animateur pédagogique, et tout
 * rôle futur). Généralisé le 2026-08-27 (docs/architecture.md).
 *
 * Il n'existe qu'un seul chemin d'accès en ÉCRITURE (création, suppression) :
 * l'utilisateur authentifié agit sur SON PROPRE carnet (`ownerId = callerId`).
 * Aucune exception, y compris pour les rôles administratifs — voir
 * `create()`/`findOne()`/`remove()` ci-dessous, inchangés depuis le
 * 2026-08-27.
 *
 * Spécification fonctionnelle réelle — notes rapides immuables (docs/
 * architecture.md, arbitrage du 2026-08-27) : une entrée est une « pensée
 * instantanée » horodatée automatiquement (`createdAt`), jamais éditée après
 * coup. Elle se supprime et se réécrit si besoin, elle ne se modifie jamais
 * — d'où l'absence délibérée d'une méthode `update()`.
 *
 * Accès administratif et parental — arbitrage du 2026-08-28 (docs/
 * architecture.md, "Acces administratif et parental au carnet personnel —
 * parametrable par le TI, defaut ferme") : `findAllForThirdParty` ouvre,
 * UNIQUEMENT EN LECTURE et UNIQUEMENT si le TI l'a activé (comportement
 * fermé par défaut), le carnet d'un titulaire à un rôle administratif
 * (RP, puis AF/TI selon le curseur `adminAccess`) ou à un parent financeur
 * activement rattaché à l'élève ciblé (`parentAccessToOwnChild`). Contrôlé à
 * chaque appel auprès de `NotebookAccessSettingsService` et, pour l'axe
 * parental, de `profile-service` — jamais en cache.
 */
@Injectable()
export class NotebookService {
  constructor(
    @InjectRepository(NotebookEntry)
    private readonly notebookEntryRepository: Repository<NotebookEntry>,
    private readonly notebookAccessSettingsService: NotebookAccessSettingsService,
    private readonly profileRelationsClient: ProfileRelationsClient,
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
   * Lecture du carnet d'un tiers (`ownerId` explicite, distinct de
   * l'appelant) — arbitrage du 2026-08-28. Toujours en LECTURE SEULE : cette
   * méthode ne donne accès à aucune écriture, `create()`/`remove()` restent
   * strictement réservées au titulaire.
   *
   * Le titulaire lisant son propre carnet via cette route reste toujours
   * autorisé, sans aucun appel réseau (repli sur le comportement normal) —
   * mêmes filtres `from`/`to`/`q` que `findAll()`.
   */
  async findAllForThirdParty(
    ownerId: string,
    callerId: string,
    callerRole: string,
    query?: FindNotebookQueryDto,
  ): Promise<NotebookEntry[]> {
    if (callerId !== ownerId) {
      await this.assertCanReadThirdParty(ownerId, callerId, callerRole);
    }
    return this.findAll(ownerId, query);
  }

  /**
   * Vérifie le droit de lecture d'un tiers sur le carnet de `ownerId`, selon
   * les deux axes indépendants du réglage TI :
   *   - administratif : RP si `adminAccess` vaut `rp` ou `all_admins` ; AF/TI
   *     si `adminAccess` vaut `all_admins` ;
   *   - parental : parent financeur si `parentAccessToOwnChild` est activé
   *     ET qu'il est activement rattaché à `ownerId` (vérifié à chaque appel
   *     auprès de `profile-service`, jamais en cache).
   *
   * Convention de code retenue (même que les statistiques et archives
   * pédagogiques) : `403` pour un rôle qui n'a STRUCTURELLEMENT jamais ce
   * droit (élève, formateur, animateur pédagogique) ; `404`, indiscernable
   * d'une absence de carnet, quand le réglage courant ne couvre pas l'appel
   * (réglage désactivé, ou relation parent-élève absente/rompue).
   * `profile-service` injoignable → `503` (échec fermé, levé par
   * `ProfileRelationsClient.getRelation`).
   */
  private async assertCanReadThirdParty(
    ownerId: string,
    callerId: string,
    callerRole: string,
  ): Promise<void> {
    const settings = await this.notebookAccessSettingsService.getSettings();

    if (callerRole === UserRole.RESPONSABLE_PEDAGOGIQUE) {
      if (
        settings.adminAccess === NotebookAdminAccess.RP ||
        settings.adminAccess === NotebookAdminAccess.ALL_ADMINS
      ) {
        return;
      }
      throw new NotFoundException(this.thirdPartyNotFoundMessage());
    }

    if (
      callerRole === UserRole.ADMINISTRATEUR_FINANCIER ||
      callerRole === UserRole.TECHNICIEN_INFORMATIQUE
    ) {
      if (settings.adminAccess === NotebookAdminAccess.ALL_ADMINS) {
        return;
      }
      throw new NotFoundException(this.thirdPartyNotFoundMessage());
    }

    if (callerRole === UserRole.PARENT_FINANCEUR) {
      if (!settings.parentAccessToOwnChild) {
        throw new NotFoundException(this.thirdPartyNotFoundMessage());
      }
      const result = await this.profileRelationsClient.getRelation(callerId, ownerId, callerRole);
      const hasActiveLink = result.relations.some(
        (relation) => relation.kind === NOTEBOOK_PARENT_RELATION_KIND,
      );
      if (!hasActiveLink) {
        throw new NotFoundException(this.thirdPartyNotFoundMessage());
      }
      return;
    }

    // Rôle structurellement jamais éligible (élève, formateur, animateur
    // pédagogique) — filtré en amont par @Roles() côté contrôleur ; ce garde-
    // fou couvre un appel direct au service (unit tests, futur appelant).
    throw new ForbiddenException(
      "Ce rôle ne peut structurellement pas lire le carnet personnel d'un tiers",
    );
  }

  private thirdPartyNotFoundMessage(): string {
    return 'Carnet personnel introuvable ou accès non autorisé';
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
