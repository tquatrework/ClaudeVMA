import { QueryFailedError } from 'typeorm';

import { IdempotencyService } from '../../src/idempotency/idempotency.service';
import { IdempotencyRecord } from '../../src/idempotency/idempotency-record.entity';

describe('IdempotencyService', () => {
  let repository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let service: IdempotencyService;

  beforeEach(() => {
    repository = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((entity) => entity),
      save: jest.fn((entity) => Promise.resolve(entity)),
    };
    service = new IdempotencyService(repository as never);
  });

  it('sans cle, la commande s\'execute normalement et rien n\'est conserve', async () => {
    const command = jest.fn().mockResolvedValue({ id: 'request-1' });

    await expect(
      service.runOnce({ endpoint: 'POST /requests', userId: 'user-1' }, command),
    ).resolves.toEqual({ id: 'request-1' });
    expect(repository.findOne).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('avec une cle inedite, la commande s\'execute et sa reponse est conservee', async () => {
    const command = jest.fn().mockResolvedValue({ id: 'request-1' });

    await service.runOnce({ idempotencyKey: 'cle-1', endpoint: 'POST /requests', userId: 'user-1' }, command);

    expect(command).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'cle-1',
        endpoint: 'POST /requests',
        userId: 'user-1',
        responseBody: { id: 'request-1' },
      }),
    );
  });

  it('un rejeu renvoie la premiere reponse SANS reexecuter la commande', async () => {
    repository.findOne.mockResolvedValue({ responseBody: { id: 'request-1' } } as IdempotencyRecord);
    const command = jest.fn();

    const replayed = await service.runOnce(
      { idempotencyKey: 'cle-1', endpoint: 'POST /requests', userId: 'user-1' },
      command,
    );

    expect(replayed).toEqual({ id: 'request-1' });
    expect(command).not.toHaveBeenCalled();
  });

  it('la cle est portee par le triplet cle + route + utilisateur', async () => {
    await service.runOnce(
      { idempotencyKey: 'cle-1', endpoint: 'POST /requests', userId: 'user-1' },
      jest.fn().mockResolvedValue({}),
    );

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { idempotencyKey: 'cle-1', endpoint: 'POST /requests', userId: 'user-1' },
    });
  });

  it('deux appels concurrents : la violation d\'unicite ne remonte pas en erreur technique', async () => {
    const uniqueViolation = new QueryFailedError('insert', [], new Error('duplicate'));
    (uniqueViolation as unknown as { driverError: { code: string } }).driverError = { code: '23505' };
    repository.save.mockRejectedValue(uniqueViolation);

    await expect(
      service.runOnce(
        { idempotencyKey: 'cle-1', endpoint: 'POST /requests', userId: 'user-1' },
        jest.fn().mockResolvedValue({ id: 'request-1' }),
      ),
    ).resolves.toEqual({ id: 'request-1' });
  });

  it('toute autre erreur de conservation remonte', async () => {
    repository.save.mockRejectedValue(new Error('disque plein'));

    await expect(
      service.runOnce(
        { idempotencyKey: 'cle-1', endpoint: 'POST /requests', userId: 'user-1' },
        jest.fn().mockResolvedValue({}),
      ),
    ).rejects.toThrow('disque plein');
  });

  it('une commande qui echoue n\'est jamais conservee : le rejeu doit pouvoir reessayer', async () => {
    const command = jest.fn().mockRejectedValue(new Error('refus metier'));

    await expect(
      service.runOnce({ idempotencyKey: 'cle-1', endpoint: 'POST /requests', userId: 'user-1' }, command),
    ).rejects.toThrow('refus metier');
    expect(repository.save).not.toHaveBeenCalled();
  });
});
