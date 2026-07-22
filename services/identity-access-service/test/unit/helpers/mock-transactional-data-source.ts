/**
 * Construit un mock de `DataSource` dont `.transaction(cb)` exécute directement `cb`
 * avec un `EntityManager` simulé : `manager.getRepository(Entity)` retourne le mock de
 * repository enregistré pour cette entité. Permet de tester les services qui utilisent
 * `DataSource.transaction` (services-convention) sans base de données réelle, tout en
 * réutilisant les mêmes mocks de repository que le reste de la suite.
 */
export interface MockTransactionalManager {
  getRepository: jest.Mock;
}

export function buildTransactionalDataSourceMock(entityRepoPairs: Array<[unknown, unknown]>) {
  const repositoriesByEntity = new Map<unknown, unknown>(entityRepoPairs);

  const manager: MockTransactionalManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (!repositoriesByEntity.has(entity)) {
        const entityName = (entity as { name?: string })?.name ?? String(entity);
        throw new Error(`No mock repository registered for entity ${entityName}`);
      }
      return repositoriesByEntity.get(entity);
    }),
  };

  return {
    transaction: jest.fn(async (runInTransaction: (manager: MockTransactionalManager) => Promise<unknown>) =>
      runInTransaction(manager),
    ),
    __manager: manager,
  };
}
