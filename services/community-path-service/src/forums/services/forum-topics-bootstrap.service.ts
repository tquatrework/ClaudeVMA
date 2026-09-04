import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Forum } from '../entities/forum.entity';
import { ForumTopic } from '../entities/forum-topic.entity';
import { ForumsService } from '../forums.service';

/**
 * Rattrapage des forums déjà existants au moment du chantier "Structure en
 * sujets (topics) des Forums" (2026-09-04, point 4/5 de l'arbitrage) : des
 * forums de test ont pu être créés pendant les vérifications HTTP directes
 * des lots précédents, avant que ce mécanisme n'existe. Au démarrage du
 * service, chaque forum sans sujet système "Sujet général" en reçoit un,
 * créé et déjà validé.
 *
 * `ForumComment` n'a plus de colonne `forumId` (remplacée par `topicId`,
 * même arbitrage) : au moment de ce chantier, la base de production ne
 * portait aucun commentaire existant (vérifié directement — `SELECT count(*)
 * FROM forum_comments` → 0), donc aucune migration de données de
 * commentaires n'était nécessaire en pratique. Si ce code devait être
 * redéployé contre un environnement portant déjà des commentaires sous
 * l'ancien schéma, une migration de données dédiée serait requise avant ce
 * changement de colonne — non construite ici faute de cas réel à couvrir.
 */
@Injectable()
export class ForumTopicsBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ForumTopicsBootstrapService.name);

  constructor(
    @InjectRepository(Forum)
    private readonly forumRepository: Repository<Forum>,
    @InjectRepository(ForumTopic)
    private readonly topicRepository: Repository<ForumTopic>,
    private readonly forumsService: ForumsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const forums = await this.forumRepository.find();
    let created = 0;

    for (const forum of forums) {
      const existingDefaultTopic = await this.topicRepository.findOne({
        where: { forumId: forum.id, isDefault: true },
      });
      if (existingDefaultTopic) continue;

      await this.forumsService.createDefaultTopic(forum.id, forum.createdById, forum.createdByRole);
      created += 1;
    }

    if (created > 0) {
      this.logger.log(`Sujet "Sujet général" créé rétroactivement pour ${created} forum(s) existant(s)`);
    }
  }
}
