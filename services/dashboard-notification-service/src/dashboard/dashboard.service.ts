import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DashboardPreference } from './entities/dashboard-preference.entity';
import { DashboardWidgetState } from './entities/dashboard-widget-state.entity';
import { NotificationService } from '../notification/notification.service';
import { UpdatePreferencesDto } from './dto/update-preferences.dto';

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
    private readonly prefRepo: Repository<DashboardPreference>,
    @InjectRepository(DashboardWidgetState)
    private readonly widgetRepo: Repository<DashboardWidgetState>,
    private readonly notificationService: NotificationService,
  ) {}

  async getMyDashboard(userId: string, role: string) {
    const preference = await this.prefRepo.findOne({ where: { userId } });

    const widgetConfig = preference?.widgetConfig ?? DEFAULT_WIDGET_CONFIGS[role] ?? {};

    const recentNotifications = await this.notificationService.findRecentByUser(userId, 10);

    const widgets = this.buildWidgets(role, widgetConfig);

    return {
      userId,
      role,
      widgets,
      notifications: recentNotifications,
      generatedAt: new Date().toISOString(),
    };
  }

  private buildWidgets(role: string, config: Record<string, unknown>): Record<string, unknown>[] {
    const widgets: Record<string, unknown>[] = [];

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

  async updatePreferences(userId: string, role: string, dto: UpdatePreferencesDto): Promise<DashboardPreference> {
    let pref = await this.prefRepo.findOne({ where: { userId } });
    if (!pref) {
      pref = this.prefRepo.create({ userId, role, widgetConfig: dto.widgetConfig });
    } else {
      pref.widgetConfig = dto.widgetConfig;
    }
    return this.prefRepo.save(pref);
  }

  async initializeDashboard(userId: string, role: string): Promise<DashboardPreference> {
    const existing = await this.prefRepo.findOne({ where: { userId } });
    if (existing) {
      return existing;
    }
    const widgetConfig = DEFAULT_WIDGET_CONFIGS[role] ?? {};
    const pref = this.prefRepo.create({ userId, role, widgetConfig });
    return this.prefRepo.save(pref);
  }

  async getPreference(userId: string): Promise<DashboardPreference | null> {
    return this.prefRepo.findOne({ where: { userId } });
  }
}
