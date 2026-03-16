import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { getToken } from 'next-auth/jwt';
import type { UserRole } from '@prisma/client';

export const createTRPCContext = async (opts: { headers: Headers }) => {
  // Extract JWT token from request headers using next-auth
  const token = await getToken({
    req: {
      headers: Object.fromEntries(opts.headers.entries()),
    } as any,
    secret: process.env.NEXTAUTH_SECRET,
  });

  return {
    headers: opts.headers,
    session: token
      ? { userId: token.userId as string, role: token.role as UserRole }
      : null,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;

/**
 * Middleware that enforces authentication.
 * Extracts userId and role from the JWT session and adds them to context.
 */
const enforceAuth = t.middleware(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '请先登录',
    });
  }

  return next({
    ctx: {
      session: ctx.session,
      userId: ctx.session.userId,
      role: ctx.session.role,
    },
  });
});

/**
 * Creates a middleware that enforces a minimum role level.
 * Role hierarchy: ADMIN > VIP_MEMBER > PAID_USER > FREE_USER
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  FREE_USER: 0,
  PAID_USER: 1,
  VIP_MEMBER: 2,
  ADMIN: 3,
};

function createRoleMiddleware(allowedRoles: UserRole[]) {
  return t.middleware(({ ctx, next }) => {
    if (!ctx.session) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '请先登录',
      });
    }

    const userRole = ctx.session.role;
    if (!allowedRoles.includes(userRole)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: '权限不足，无法访问此资源',
      });
    }

    return next({
      ctx: {
        session: ctx.session,
        userId: ctx.session.userId,
        role: ctx.session.role,
      },
    });
  });
}

/**
 * Protected procedure - requires any authenticated user.
 * Roles: FREE_USER, PAID_USER, VIP_MEMBER, ADMIN
 */
export const protectedProcedure = t.procedure.use(enforceAuth);

/**
 * Paid procedure - requires at least PAID_USER level.
 * Roles: PAID_USER, VIP_MEMBER, ADMIN
 */
export const paidProcedure = t.procedure.use(
  createRoleMiddleware(['PAID_USER', 'VIP_MEMBER', 'ADMIN']),
);

/**
 * VIP procedure - requires at least VIP_MEMBER level.
 * Roles: VIP_MEMBER, ADMIN
 */
export const vipProcedure = t.procedure.use(
  createRoleMiddleware(['VIP_MEMBER', 'ADMIN']),
);

/**
 * Admin procedure - requires ADMIN role only.
 * Roles: ADMIN
 */
export const adminProcedure = t.procedure.use(
  createRoleMiddleware(['ADMIN']),
);

// Export for testing
export { ROLE_HIERARCHY, createRoleMiddleware, enforceAuth };
