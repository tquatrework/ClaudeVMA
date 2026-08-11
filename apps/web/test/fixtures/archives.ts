/**
 * Fixtures d'archives pédagogiques — copiées de la pile réelle
 * (https://claudevma.visioprof.fr, 2026-08-11), pas inventées.
 *
 * Elles portent la forme exacte du serveur : enveloppe paginée, `itemType`
 * réellement renvoyés (`resume_de_cours`, `cahier_de_texte`, `carnet_personnel`…),
 * `isParentVisible`, `sourceId`/`sourceService`, et **aucun** `sourceUrl`.
 * C'est parce que les anciennes fixtures inventaient ces champs que la suite
 * restait verte pendant que l'écran restait vide.
 */

import type {
  ArchiveTimelineGroup,
  PaginatedArchiveResponse,
  PedagogicalArchiveItem,
} from '../../src/api/archiveDocument'

export const STUDENT_ID = 'fd0fe655-cd28-4f75-b225-846e8aad7e62'

export const COURSE_SUMMARY_ITEM: PedagogicalArchiveItem = {
  id: '9a24fe28-b4a9-47a3-baf3-5827376c89af',
  studentId: STUDENT_ID,
  itemType: 'resume_de_cours',
  sourceId: '7f0e6d38-1111-4a11-9111-000000000001',
  sourceService: 'video-session-service',
  title: 'Résumé du cours du 3 mars',
  description: 'Introduction aux matrices carrées.',
  downloadUrl: null,
  score: null,
  pedagogicalPoints: 0,
  occurredAt: '2026-03-03T10:00:00.000Z',
  isParentVisible: true,
  idempotencyKey: null,
  createdAt: '2026-08-11T13:46:00.975Z',
  updatedAt: '2026-08-11T13:46:00.975Z',
}

export const PEDAGOGICAL_LOG_ITEM: PedagogicalArchiveItem = {
  id: '271bf799-922e-4063-af29-e01cb67d15c7',
  studentId: STUDENT_ID,
  itemType: 'cahier_de_texte',
  sourceId: '7f0e6d38-1111-4a11-9111-000000000002',
  sourceService: 'pedagogical-log-service',
  title: 'Cahier de texte — équations',
  description: 'Travail sur les dérivées.',
  downloadUrl: 'https://example.com/download/2',
  score: 14,
  pedagogicalPoints: 3,
  occurredAt: '2026-03-04T10:00:00.000Z',
  isParentVisible: true,
  idempotencyKey: null,
  createdAt: '2026-08-11T13:46:01.043Z',
  updatedAt: '2026-08-11T13:46:01.043Z',
}

export const NOTEBOOK_ENTRY_ITEM: PedagogicalArchiveItem = {
  id: 'a2cc39f8-4266-4e9a-b516-39dd0456c616',
  studentId: STUDENT_ID,
  itemType: 'carnet_personnel',
  sourceId: '7f0e6d38-1111-4a11-9111-000000000003',
  sourceService: 'pedagogical-log-service',
  title: 'Note personnelle',
  description: 'Idée de révision.',
  downloadUrl: null,
  score: null,
  pedagogicalPoints: 0,
  occurredAt: '2026-03-05T10:00:00.000Z',
  isParentVisible: false,
  idempotencyKey: null,
  createdAt: '2026-08-11T13:46:01.105Z',
  updatedAt: '2026-08-11T13:46:01.105Z',
}

export const TIMELINE_GROUPS: ArchiveTimelineGroup[] = [
  {
    date: '2026-03-03',
    items: [
      {
        id: COURSE_SUMMARY_ITEM.id,
        itemType: 'resume_de_cours',
        title: COURSE_SUMMARY_ITEM.title,
        sourceId: COURSE_SUMMARY_ITEM.sourceId,
        sourceService: COURSE_SUMMARY_ITEM.sourceService,
        score: null,
        pedagogicalPoints: 0,
      },
    ],
  },
  {
    date: '2026-03-04',
    items: [
      {
        id: PEDAGOGICAL_LOG_ITEM.id,
        itemType: 'cahier_de_texte',
        title: PEDAGOGICAL_LOG_ITEM.title,
        sourceId: PEDAGOGICAL_LOG_ITEM.sourceId,
        sourceService: PEDAGOGICAL_LOG_ITEM.sourceService,
        score: 14,
        pedagogicalPoints: 3,
      },
    ],
  },
  {
    date: '2026-03-05',
    items: [
      {
        id: NOTEBOOK_ENTRY_ITEM.id,
        itemType: 'carnet_personnel',
        title: NOTEBOOK_ENTRY_ITEM.title,
        sourceId: NOTEBOOK_ENTRY_ITEM.sourceId,
        sourceService: NOTEBOOK_ENTRY_ITEM.sourceService,
        score: null,
        pedagogicalPoints: 0,
      },
    ],
  },
]

export function paginate<T>(items: T[]): PaginatedArchiveResponse<T> {
  return { data: items, page: 1, limit: 20, total: items.length, totalPages: 1 }
}
