export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

const DEFAULT_PAGE_SIZE = 20;

/**
 * Generic paginated query helper for Prisma models.
 *
 * @param model - A Prisma delegate with `findMany` and `count` methods
 * @param where - Prisma where clause for filtering
 * @param params - Pagination parameters (page, pageSize)
 * @param orderBy - Optional Prisma orderBy clause
 * @returns Paginated result with items, total, page info
 */
export async function paginate<T>(
  model: {
    findMany: (args: Record<string, unknown>) => Promise<T[]>;
    count: (args: Record<string, unknown>) => Promise<number>;
  },
  where: Record<string, unknown> = {},
  params: PaginationParams = {},
  orderBy?: Record<string, unknown> | Record<string, unknown>[],
): Promise<PaginatedResult<T>> {
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(1, params.pageSize ?? DEFAULT_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const [items, total] = await Promise.all([
    model.findMany({
      where,
      skip,
      take: pageSize,
      ...(orderBy ? { orderBy } : {}),
    }),
    model.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
