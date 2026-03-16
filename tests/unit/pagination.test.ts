import { describe, it, expect } from 'vitest';
import { paginate, type PaginatedResult } from '@/lib/pagination';

function createMockModel<T>(data: T[]) {
  return {
    findMany: async (args: Record<string, unknown>): Promise<T[]> => {
      const skip = (args.skip as number) ?? 0;
      const take = (args.take as number) ?? data.length;
      return data.slice(skip, skip + take);
    },
    count: async (_args: Record<string, unknown>): Promise<number> => {
      return data.length;
    },
  };
}

describe('paginate', () => {
  const items = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

  it('returns first page with default page size of 20', async () => {
    const model = createMockModel(items);
    const result = await paginate(model, {});

    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.total).toBe(50);
    expect(result.totalPages).toBe(3);
    expect(result.items).toHaveLength(20);
  });

  it('returns correct page when page param is specified', async () => {
    const model = createMockModel(items);
    const result = await paginate(model, {}, { page: 2, pageSize: 10 });

    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.total).toBe(50);
    expect(result.totalPages).toBe(5);
    expect(result.items).toHaveLength(10);
    expect(result.items[0]).toEqual({ id: 11, name: 'Item 11' });
  });

  it('returns empty items for page beyond total', async () => {
    const model = createMockModel(items);
    const result = await paginate(model, {}, { page: 100, pageSize: 20 });

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(50);
    expect(result.totalPages).toBe(3);
  });

  it('handles empty dataset', async () => {
    const model = createMockModel([]);
    const result = await paginate(model, {});

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.page).toBe(1);
  });

  it('clamps page to minimum of 1', async () => {
    const model = createMockModel(items);
    const result = await paginate(model, {}, { page: -5 });

    expect(result.page).toBe(1);
  });

  it('clamps pageSize to minimum of 1', async () => {
    const model = createMockModel(items);
    const result = await paginate(model, {}, { pageSize: 0 });

    expect(result.pageSize).toBe(1);
  });

  it('calculates totalPages correctly for exact division', async () => {
    const exactItems = Array.from({ length: 40 }, (_, i) => ({ id: i }));
    const model = createMockModel(exactItems);
    const result = await paginate(model, {}, { pageSize: 10 });

    expect(result.totalPages).toBe(4);
  });

  it('calculates totalPages correctly for non-exact division', async () => {
    const oddItems = Array.from({ length: 41 }, (_, i) => ({ id: i }));
    const model = createMockModel(oddItems);
    const result = await paginate(model, {}, { pageSize: 10 });

    expect(result.totalPages).toBe(5);
  });

  it('passes orderBy to findMany when provided', async () => {
    let capturedArgs: Record<string, unknown> = {};
    const model = {
      findMany: async (args: Record<string, unknown>) => {
        capturedArgs = args;
        return [];
      },
      count: async () => 0,
    };

    await paginate(model, {}, {}, { createdAt: 'desc' });
    expect(capturedArgs.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('does not include orderBy when not provided', async () => {
    let capturedArgs: Record<string, unknown> = {};
    const model = {
      findMany: async (args: Record<string, unknown>) => {
        capturedArgs = args;
        return [];
      },
      count: async () => 0,
    };

    await paginate(model, {});
    expect(capturedArgs).not.toHaveProperty('orderBy');
  });
});
