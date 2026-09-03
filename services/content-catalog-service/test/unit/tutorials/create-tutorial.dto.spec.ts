/**
 * Validation class-validator de CreateTutorialDto (refonte du 2026-09-03).
 * Complète les tests de règles métier de TutorialsService : ici on vérifie
 * uniquement ce que les décorateurs valident avant que le service ne soit
 * appelé (le ValidationPipe global du service, `whitelist: true, transform:
 * true`).
 */

import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateTutorialDto } from '../../../src/tutorials/dto/create-tutorial.dto';
import { TutorialFormat } from '../../../src/tutorials/enums/tutorial-format.enum';
import { TutorialBlockCategory } from '../../../src/tutorials/enums/tutorial-block-category.enum';
import { TUTORIAL_BLOCK_CONTENT_MAX_LENGTH } from '../../../src/tutorials/tutorial.constants';

async function validateDto(plain: Record<string, unknown>) {
  const instance = plainToInstance(CreateTutorialDto, plain);
  return validate(instance);
}

describe('CreateTutorialDto', () => {
  it('accepte un tutoriel vidéo minimal valide', async () => {
    const errors = await validateDto({
      title: 'Ma vidéo',
      format: TutorialFormat.VIDEO,
      videoUrl: 'https://videos.example.com/embed/abc',
    });
    expect(errors).toHaveLength(0);
  });

  it('accepte un tutoriel post avec des blocs texte (contenu opaque, y compris JSON structuré)', async () => {
    const errors = await validateDto({
      title: 'Mon post',
      format: TutorialFormat.POST,
      blocks: [
        { category: TutorialBlockCategory.TEXT, content: 'Introduction' },
        {
          category: TutorialBlockCategory.TEXT,
          content: JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', text: 'Un contenu riche' }] }),
        },
      ],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejette la catégorie de bloc "title" (retirée, fusionnée dans "text")', async () => {
    const errors = await validateDto({
      title: 'x',
      format: TutorialFormat.POST,
      blocks: [{ category: 'title', content: 'Introduction' }],
    });
    const blocksError = errors.find((e) => e.property === 'blocks');
    expect(blocksError).toBeDefined();
  });

  it('rejette un titre vide', async () => {
    const errors = await validateDto({ title: '', format: TutorialFormat.POST });
    expect(errors.some((e) => e.property === 'title')).toBe(true);
  });

  it('rejette un format inconnu', async () => {
    const errors = await validateDto({ title: 'x', format: 'diaporama' });
    expect(errors.some((e) => e.property === 'format')).toBe(true);
  });

  it('rejette une videoUrl syntaxiquement invalide', async () => {
    const errors = await validateDto({ title: 'x', format: TutorialFormat.VIDEO, videoUrl: 'pas-une-url' });
    expect(errors.some((e) => e.property === 'videoUrl')).toBe(true);
  });

  it('rejette un linkedQuizId non-UUID', async () => {
    const errors = await validateDto({ title: 'x', format: TutorialFormat.POST, linkedQuizId: 'pas-un-uuid' });
    expect(errors.some((e) => e.property === 'linkedQuizId')).toBe(true);
  });

  it('rejette une catégorie de bloc inconnue', async () => {
    const errors = await validateDto({
      title: 'x',
      format: TutorialFormat.POST,
      blocks: [{ category: 'paragraphe', content: 'x' }],
    });
    const blocksError = errors.find((e) => e.property === 'blocks');
    expect(blocksError).toBeDefined();
  });

  it('accepte un contenu de bloc texte jusqu\'à la nouvelle limite (20000 caractères, document structuré)', async () => {
    const content = 'a'.repeat(TUTORIAL_BLOCK_CONTENT_MAX_LENGTH);
    const errors = await validateDto({
      title: 'x',
      format: TutorialFormat.POST,
      blocks: [{ category: TutorialBlockCategory.TEXT, content }],
    });
    expect(errors).toHaveLength(0);
  });

  it('rejette un contenu de bloc texte au-delà de la nouvelle limite (20000 caractères)', async () => {
    const content = 'a'.repeat(TUTORIAL_BLOCK_CONTENT_MAX_LENGTH + 1);
    const errors = await validateDto({
      title: 'x',
      format: TutorialFormat.POST,
      blocks: [{ category: TutorialBlockCategory.TEXT, content }],
    });
    const blocksError = errors.find((e) => e.property === 'blocks');
    expect(blocksError).toBeDefined();
  });
});
