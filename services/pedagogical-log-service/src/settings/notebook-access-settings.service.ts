import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotebookAccessSettings,
  NOTEBOOK_ACCESS_SETTINGS_SINGLETON_ID,
} from './entities/notebook-access-settings.entity';
import { UpdateNotebookAccessSettingsDto } from './dto/update-notebook-access-settings.dto';

/**
 * NotebookAccessSettingsService — réglages TI de l'accès en lecture seule
 * d'un tiers au carnet personnel (docs/architecture.md, arbitrage du
 * 2026-08-28). Consommé par `NotebookService.assertCanReadThirdParty` à
 * CHAQUE lecture d'un carnet tiers, jamais en cache.
 */
@Injectable()
export class NotebookAccessSettingsService {
  constructor(
    @InjectRepository(NotebookAccessSettings)
    private readonly settingsRepository: Repository<NotebookAccessSettings>,
  ) {}

  /**
   * Lit les réglages courants, en créant la ligne singleton (valeurs par
   * défaut : `adminAccess = 'none'`, `parentAccessToOwnChild = false`) si
   * elle n'existe pas encore. Une lecture ne doit jamais échouer faute de
   * réglages présents — même discipline que `PedagogicalLogSettingsService`.
   */
  async getSettings(): Promise<NotebookAccessSettings> {
    let settings = await this.settingsRepository.findOne({
      where: { id: NOTEBOOK_ACCESS_SETTINGS_SINGLETON_ID },
    });
    if (!settings) {
      settings = this.settingsRepository.create({ id: NOTEBOOK_ACCESS_SETTINGS_SINGLETON_ID });
      settings = await this.settingsRepository.save(settings);
    }
    return settings;
  }

  /**
   * Modifie les réglages — réservé au technicien_informatique côté
   * contrôleur. Mise à jour partielle : seuls les champs fournis changent.
   */
  async updateSettings(dto: UpdateNotebookAccessSettingsDto): Promise<NotebookAccessSettings> {
    const settings = await this.getSettings();
    Object.assign(settings, dto);
    return this.settingsRepository.save(settings);
  }
}
