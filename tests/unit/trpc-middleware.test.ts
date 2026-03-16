import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock next-auth/jwt before importing trpc module
vi.mock('next-auth/jwt', () => ({
  getToken: vi.fn(),
}));

import { getToken } from 'next-auth/jwt';
import {
  createTRPCContext,
  createTRPCRouter,
  publicProcedure,
  protectedProcedure,
  paidProcedure,
  vipProcedure,
  adminProcedure,
  createCallerFactory,
} from '@/server/trpc';

const mockedGetToken = vi.mocked(getToken);

// Helper to create a context with a specific role
function createMockContext(
  session: { userId: string; role: string } | null,
) {
  return {
    headers: new Headers(),
    session: session as any,
  };
}

// Create a test router with all procedure types
const testRouter = createTRPCRouter({
  publicRoute: publicProcedure.query(() => 'public'),
  protectedRoute: protectedProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    role: ctx.role,
  })),
  paidRoute: paidProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    role: ctx.role,
  })),
  vipRoute: vipProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    role: ctx.role,
  })),
  adminRoute: adminProcedure.query(({ ctx }) => ({
    userId: ctx.userId,
    role: ctx.role,
  })),
});

const createCaller = createCallerFactory(testRouter);

describe('createTRPCContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null session when no JWT token is present', async () => {
    mockedGetToken.mockResolvedValue(null);
    const ctx = await createTRPCContext({ headers: new Headers() });
    expect(ctx.session).toBeNull();
  });

  it('should extract userId and role from JWT token', async () => {
    mockedGetToken.mockResolvedValue({
      userId: 'user-123',
      role: 'PAID_USER',
    } as any);
    const ctx = await createTRPCContext({ headers: new Headers() });
    expect(ctx.session).toEqual({
      userId: 'user-123',
      role: 'PAID_USER',
    });
  });
});

describe('protectedProcedure', () => {
  it('should reject unauthenticated requests', async () => {
    const caller = createCaller(createMockContext(null));
    await expect(caller.protectedRoute()).rejects.toThrow(TRPCError);
    await expect(caller.protectedRoute()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it.each([
    { role: 'FREE_USER' },
    { role: 'PAID_USER' },
    { role: 'VIP_MEMBER' },
    { role: 'ADMIN' },
  ])('should allow $role access', async ({ role }) => {
    const caller = createCaller(
      createMockContext({ userId: 'user-1', role }),
    );
    const result = await caller.protectedRoute();
    expect(result).toEqual({ userId: 'user-1', role });
  });
});

describe('paidProcedure', () => {
  it('should reject unauthenticated requests', async () => {
    const caller = createCaller(createMockContext(null));
    await expect(caller.paidRoute()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('should reject FREE_USER', async () => {
    const caller = createCaller(
      createMockContext({ userId: 'user-1', role: 'FREE_USER' }),
    );
    await expect(caller.paidRoute()).rejects.toThrow(TRPCError);
    await expect(caller.paidRoute()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it.each([
    { role: 'PAID_USER' },
    { role: 'VIP_MEMBER' },
    { role: 'ADMIN' },
  ])('should allow $role access', async ({ role }) => {
    const caller = createCaller(
      createMockContext({ userId: 'user-1', role }),
    );
    const result = await caller.paidRoute();
    expect(result).toEqual({ userId: 'user-1', role });
  });
});

describe('vipProcedure', () => {
  it('should reject unauthenticated requests', async () => {
    const caller = createCaller(createMockContext(null));
    await expect(caller.vipRoute()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it.each([{ role: 'FREE_USER' }, { role: 'PAID_USER' }])(
    'should reject $role',
    async ({ role }) => {
      const caller = createCaller(
        createMockContext({ userId: 'user-1', role }),
      );
      await expect(caller.vipRoute()).rejects.toMatchObject({
        code: 'FORBIDDEN',
      });
    },
  );

  it.each([{ role: 'VIP_MEMBER' }, { role: 'ADMIN' }])(
    'should allow $role access',
    async ({ role }) => {
      const caller = createCaller(
        createMockContext({ userId: 'user-1', role }),
      );
      const result = await caller.vipRoute();
      expect(result).toEqual({ userId: 'user-1', role });
    },
  );
});

describe('adminProcedure', () => {
  it('should reject unauthenticated requests', async () => {
    const caller = createCaller(createMockContext(null));
    await expect(caller.adminRoute()).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it.each([
    { role: 'FREE_USER' },
    { role: 'PAID_USER' },
    { role: 'VIP_MEMBER' },
  ])('should reject $role', async ({ role }) => {
    const caller = createCaller(
      createMockContext({ userId: 'user-1', role }),
    );
    await expect(caller.adminRoute()).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('should allow ADMIN access', async () => {
    const caller = createCaller(
      createMockContext({ userId: 'admin-1', role: 'ADMIN' }),
    );
    const result = await caller.adminRoute();
    expect(result).toEqual({ userId: 'admin-1', role: 'ADMIN' });
  });
});

describe('publicProcedure', () => {
  it('should allow unauthenticated access', async () => {
    const caller = createCaller(createMockContext(null));
    const result = await caller.publicRoute();
    expect(result).toBe('public');
  });
});

describe('context enrichment', () => {
  it('should add userId and role to context in protected procedures', async () => {
    const caller = createCaller(
      createMockContext({ userId: 'ctx-user', role: 'FREE_USER' }),
    );
    const result = await caller.protectedRoute();
    expect(result.userId).toBe('ctx-user');
    expect(result.role).toBe('FREE_USER');
  });

  it('should add userId and role to context in role-based procedures', async () => {
    const caller = createCaller(
      createMockContext({ userId: 'ctx-admin', role: 'ADMIN' }),
    );
    const result = await caller.adminRoute();
    expect(result.userId).toBe('ctx-admin');
    expect(result.role).toBe('ADMIN');
  });
});
