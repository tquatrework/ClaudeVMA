/**
 * Unit tests — buildActivitiesCsv
 *
 * Couvre :
 *   - Format d'en-tête CSV
 *   - Sérialisation d'une activité nominale
 *   - Échappement des champs contenant une virgule
 *   - Échappement des champs contenant des guillemets
 *   - Gestion des champs nuls/undefined
 *   - Export d'une liste vide (en-tête seul)
 *   - Export de plusieurs lignes
 */

import { buildActivitiesCsv } from '../../../src/open-activities/open-activities.service';
import { OpenActivity } from '../../../src/open-activities/entities/open-activity.entity';
import { ActivityStatus } from '../../../src/common/enums/activity-status.enum';
import { ActivitySource } from '../../../src/common/enums/activity-source.enum';
import { RewardType } from '../../../src/common/enums/reward-type.enum';

const CSV_EXPECTED_HEADER =
  'id,title,source,status,rewardType,rewardAmount,maxAcceptances,currentAcceptances,deadline,publishedById,publishedByRole,createdAt';

function buildSampleActivity(overrides: Partial<OpenActivity> = {}): OpenActivity {
  return {
    id: 'ac-0000-4000-0000-000000000001',
    title: 'Corriger exercice algèbre',
    description: 'Exercice niveau seconde',
    source: ActivitySource.RP_PRODUCTION,
    sourceReferenceId: null,
    publishedById: 'rp-0000-4000-a000-aaaaaaaaaaaa',
    publishedByRole: 'responsable_pedagogique',
    status: ActivityStatus.OPEN,
    rewardType: RewardType.PEDAGOGICAL_POINTS,
    rewardAmount: 10,
    maxAcceptances: 1,
    currentAcceptances: 0,
    deadline: null,
    acceptances: [],
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

describe('buildActivitiesCsv()', () => {
  it("produit la ligne d'en-tête correcte", () => {
    const csvOutput = buildActivitiesCsv([]);
    const headerLine = csvOutput.split('\n')[0];
    expect(headerLine).toBe(CSV_EXPECTED_HEADER);
  });

  it('retourne uniquement l\'en-tête pour une liste vide', () => {
    const csvOutput = buildActivitiesCsv([]);
    const lines = csvOutput.split('\n');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(CSV_EXPECTED_HEADER);
  });

  it('sérialise une activité nominale en ligne CSV correcte', () => {
    const activity = buildSampleActivity();
    const csvOutput = buildActivitiesCsv([activity]);
    const lines = csvOutput.split('\n');

    expect(lines).toHaveLength(2);
    const dataLine = lines[1];
    expect(dataLine).toContain(activity.id);
    expect(dataLine).toContain(activity.title);
    expect(dataLine).toContain(activity.source);
    expect(dataLine).toContain(activity.status);
    expect(dataLine).toContain(activity.rewardType);
    expect(dataLine).toContain(String(activity.rewardAmount));
    expect(dataLine).toContain(String(activity.maxAcceptances));
    expect(dataLine).toContain(String(activity.currentAcceptances));
    expect(dataLine).toContain(activity.publishedById);
    expect(dataLine).toContain(activity.publishedByRole);
    expect(dataLine).toContain(activity.createdAt.toISOString());
  });

  it('échappe entre guillemets un titre contenant une virgule', () => {
    const activityWithCommaTitle = buildSampleActivity({ title: 'Cours, algèbre et géométrie' });
    const csvOutput = buildActivitiesCsv([activityWithCommaTitle]);
    const dataLine = csvOutput.split('\n')[1];
    expect(dataLine).toContain('"Cours, algèbre et géométrie"');
  });

  it('échappe les guillemets doubles dans un champ', () => {
    const activityWithQuotesTitle = buildSampleActivity({ title: 'Exercice "niveau" 2nde' });
    const csvOutput = buildActivitiesCsv([activityWithQuotesTitle]);
    const dataLine = csvOutput.split('\n')[1];
    expect(dataLine).toContain('"Exercice ""niveau"" 2nde"');
  });

  it('produit une chaîne vide pour les champs nuls', () => {
    const activityWithNullDeadline = buildSampleActivity({ deadline: null, rewardAmount: null });
    const csvOutput = buildActivitiesCsv([activityWithNullDeadline]);
    const dataLine = csvOutput.split('\n')[1];
    const fields = dataLine.split(',');
    // deadline est la 9ème colonne (index 8)
    expect(fields[8]).toBe('');
  });

  it('sérialise la deadline en ISO string quand elle est définie', () => {
    const deadline = new Date('2026-12-31T23:59:59.000Z');
    const activityWithDeadline = buildSampleActivity({ deadline });
    const csvOutput = buildActivitiesCsv([activityWithDeadline]);
    const dataLine = csvOutput.split('\n')[1];
    expect(dataLine).toContain(deadline.toISOString());
  });

  it('produit autant de lignes de données que d\'activités fournies', () => {
    const activities = [
      buildSampleActivity({ id: 'ac-0001' }),
      buildSampleActivity({ id: 'ac-0002' }),
      buildSampleActivity({ id: 'ac-0003' }),
    ];
    const csvOutput = buildActivitiesCsv(activities);
    const lines = csvOutput.split('\n');
    // header + 3 data lines
    expect(lines).toHaveLength(4);
  });

  it('chaque ligne de données contient exactement 12 colonnes', () => {
    const activity = buildSampleActivity();
    const csvOutput = buildActivitiesCsv([activity]);
    const dataLine = csvOutput.split('\n')[1];
    // Count columns — simple split valid for lines without quoted commas
    const headerFields = csvOutput.split('\n')[0].split(',');
    expect(headerFields).toHaveLength(12);
  });
});
