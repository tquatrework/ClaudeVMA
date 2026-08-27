import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  PedagogicalLogSettings,
  PEDAGOGICAL_LOG_SETTINGS_SINGLETON_ID,
} from './entities/pedagogical-log-settings.entity';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class PedagogicalLogSettingsService {
  constructor(
    @InjectRepository(PedagogicalLogSettings)
    private readonly settingsRepository: Repository<PedagogicalLogSettings>,
  ) {}

  /**
   * Lit les réglages courants, en créant la ligne singleton (avec les
   * valeurs par défaut de l'entité) si elle n'existe pas encore — par
   * exemple sur une base migrée avant l'introduction de la ligne de seed.
   * Une lecture ne doit jamais échouer faute de réglages présents.
   */
  async getSettings(): Promise<PedagogicalLogSettings> {
    let settings = await this.settingsRepository.findOne({
      where: { id: PEDAGOGICAL_LOG_SETTINGS_SINGLETON_ID },
    });
    if (!settings) {
      settings = this.settingsRepository.create({ id: PEDAGOGICAL_LOG_SETTINGS_SINGLETON_ID });
      settings = await this.settingsRepository.save(settings);
    }
    return settings;
  }

  /**
   * Modifie les réglages — réservé au technicien_informatique côté
   * contrôleur. Mise à jour partielle : seuls les champs fournis changent.
   */
  async updateSettings(dto: UpdateSettingsDto): Promise<PedagogicalLogSettings> {
    const settings = await this.getSettings();
    Object.assign(settings, dto);

    if (settings.maxFileBytes > settings.maxTotalBytesPerEntry) {
      throw new BadRequestException(
        'Le plafond par fichier ne peut pas dépasser le plafond total par entrée',
      );
    }

    return this.settingsRepository.save(settings);
  }
}
