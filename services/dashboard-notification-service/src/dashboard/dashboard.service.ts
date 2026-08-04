import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardPreference } from './entities/dashboard-preference.entity';
import { DashboardWidgetState } from './entities/dashboard-widget-state.entity';
import { NotificationService } from '../notification/notification.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';
import { DashboardResponseDto } from './dto/dashboard-response.dto';
import { DashboardPreferenceResponseDto } from './dto/dashboard-preference-response.dto';
import { DashboardWidgetDto } from './dto/dashboard-widget.dto';
import { Actor } from '../common/types/actor';

const DEFAULT_WIDGET_CONFIGS: Record<string, Record<string, unknown>> = {
  eleve: {
    showNotifications: true,
    showCalendar: true,
    showPedagogicalScore: true,
    showFinancialBalance: true,
    showUpcomingActivities: true,
  },
  parent_financeur: {
    showNotifications: true,
    showLinkedStudents: true,
    showFinancialBalance: true,
  },
  formateur: {
    showNotifications: true,
    showCalendar: true,
    showPendingRequests: true,
  },
  responsable_pedagogique: {
    showNotifications: true,
    showPendingTeacherRequests: true,
    showPaymentAlerts: true,
  },
  technicien_informatique: {
    showNotifications: true,
    showIncidents: true,
    showSystemAlerts: true,
  },
  administrateur_financier: {
    showNotifications: true,
    showFinancialAlerts: true,
    showLegalAlerts: true,
  },
  animateur_pedagogique: {
    showNotifications: true,
    showPendingContent: true,
  },
};

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(DashboardPreference)
    private readonly preferenceRepository: Repository<DashboardPreference>,
    @InjectRepository(DashboardWidgetState)
    private readonly widgetStateRepository: Repository<DashboardWidgetState>,
    private readonly notificationService: NotificationService,
  ) {}

  /** Use case: build the actor's role-contextualised dashboard. */
  async getMyDashboard(actor: Actor): Promise<DashboardResponseDto> {
    const preference = await this.preferenceRepository.findOne({ where: { userId: actor.id } });

    const widgetConfig = preference?.widgetConfig ?? DEFAULT_WIDGET_CONFIGS[actor.role] ?? {};

    const recentNotifications = await this.notificationService.findRecentByUser(actor, 10);

    const widgets = this.buildWidgets(actor.role, widgetConfig);

    const response = new DashboardResponseDto();
    response.userId = actor.id;
    response.role = actor.role;
    response.widgets = widgets;
    response.notifications = recentNotifications;
    response.generatedAt = new Date().toISOString();
    return response;
  }

  private buildWidgets(role: string, config: Record<string, unknown>): DashboardWidgetDto[] {
    const widgets: DashboardWidgetDto[] = [];

    if (config.showCalendar) {
      widgets.push({ type: 'calendar', label: 'Calendrier', ref: 'calendar-service' });
    }
    if (config.showPedagogicalScore) {
      widgets.push({ type: 'pedagogical_score', label: 'Score pédagogique', ref: 'learning-activity-service' });
    }
    if (config.showFinancialBalance) {
      widgets.push({ type: 'financial_balance', label: 'Solde financier', ref: 'finance-credit-service' });
    }
    if (config.showUpcomingActivities) {
      widgets.push({ type: 'upcoming_activities', label: 'Activités à venir', ref: 'calendar-service' });
    }
    if (config.showLinkedStudents) {
      widgets.push({ type: 'linked_students', label: 'Élèves liés', ref: 'profile-service', note: 'excludes_personal_notebook' });
    }
    if (config.showPendingRequests) {
      widgets.push({ type: 'pending_requests', label: 'Demandes en cours', ref: 'teacher-request-service' });
    }
    if (config.showPendingTeacherRequests) {
      widgets.push({ type: 'pending_teacher_requests', label: 'Demandes professeur', ref: 'teacher-request-service' });
    }
    if (config.showPaymentAlerts) {
      widgets.push({ type: 'payment_alerts', label: 'Alertes paiement', ref: 'finance-credit-service' });
    }
    if (config.showIncidents) {
      widgets.push({ type: 'incidents', label: 'Incidents', ref: 'admin-observability-service' });
    }
    if (config.showSystemAlerts) {
      widgets.push({ type: 'system_alerts', label: 'Alertes système', ref: 'admin-observability-service' });
    }
    if (config.showFinancialAlerts) {
      widgets.push({ type: 'financial_alerts', label: 'Alertes financières', ref: 'finance-credit-service' });
    }
    if (config.showLegalAlerts) {
      widgets.push({ type: 'legal_alerts', label: 'Alertes légales', ref: 'legal-document-service' });
    }
    if (config.showPendingContent) {
      widgets.push({ type: 'pending_content', label: 'Contenus en attente', ref: 'content-catalog-service' });
    }
    if (config.showNotifications !== false) {
      widgets.push({ type: 'notifications', label: 'Notifications', ref: 'local' });
    }

    return widgets;
  }

  /** Use case: save the actor's own widget configuration. */
  async updatePreferences(actor: Actor, dto: UpdatePreferencesDto): Promise<DashboardPreferenceResponseDto> {
    let preference = await this.preferenceRepository.findOne({ where: { userId: actor.id } });
    if (!preference) {
      preference = this.preferenceRepository.create({
        userId: actor.id,
        role: actor.role,
        widgetConfig: dto.widgetConfig,
      });
    } else {
      preference.widgetConfig = dto.widgetConfig;
    }
    const saved = await this.preferenceRepository.save(preference);
    return DashboardPreferenceResponseDto.fromEntity(saved);
  }

  /**
   * Use case: create the default dashboard preference for a newly onboarded
   * user. Called by orchestration-service — idempotent, safe to call more
   * than once for the same target user.
   */
  async initializeDashboard(targetUser: Actor): Promise<DashboardPreferenceResponseDto> {
    const existing = await this.preferenceRepository.findOne({ where: { userId: targetUser.id } });
    if (existing) {
      return DashboardPreferenceResponseDto.fromEntity(existing);
    }
    const widgetConfig = DEFAULT_WIDGET_CONFIGS[targetUser.role] ?? {};
    const preference = this.preferenceRepository.create({
      userId: targetUser.id,
      role: targetUser.role,
      widgetConfig,
    });
    const saved = await this.preferenceRepository.save(preference);
    return DashboardPreferenceResponseDto.fromEntity(saved);
  }

  async getPreference(userId: string): Promise<DashboardPreference | null> {
    return this.preferenceRepository.findOne({ where: { userId } });
  }
}
