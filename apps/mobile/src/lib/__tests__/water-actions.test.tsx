import { quickAddWater, undoQuickAddWater } from '../water-actions';

describe('water quick-add actions', () => {
  const createdWaterLog = {
    id: 'water-log-1',
    amountMl: 250,
    loggedAt: '2026-08-08T14:30:00.000Z',
    createdAt: '2026-08-08T14:30:00.000Z',
    updatedAt: '2026-08-08T14:30:00.000Z',
  };

  it('uses the canonical water-log create payload for the 250 mL quick add', async () => {
    const create = jest.fn().mockResolvedValue(createdWaterLog);
    const loggedAt = new Date('2026-08-08T14:30:00.000Z');

    await expect(
      quickAddWater({ create, delete: jest.fn() }, loggedAt),
    ).resolves.toEqual(createdWaterLog);
    expect(create).toHaveBeenCalledWith({
      amountMl: 250,
      loggedAt: '2026-08-08T14:30:00.000Z',
    });
  });

  it('undoes a quick add through the same water-log resource', async () => {
    const remove = jest.fn().mockResolvedValue({
      id: createdWaterLog.id,
      deleted: true,
    });

    await expect(
      undoQuickAddWater(
        { create: jest.fn(), delete: remove },
        createdWaterLog.id,
      ),
    ).resolves.toEqual({ id: createdWaterLog.id, deleted: true });
    expect(remove).toHaveBeenCalledWith(createdWaterLog.id);
  });
});
