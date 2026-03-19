import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from '@/lib/prisma';
import { verifyPassword, verifyCode } from '@/lib/auth-helpers';
import WeChatProvider from '@/lib/auth-providers/wechat';
import LineProvider from '@/lib/auth-providers/line';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours — session expires after 8h of inactivity
  },
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Email & Password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('请提供邮箱和密码');
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.passwordHash) {
          throw new Error('邮箱或密码错误');
        }

        // Check account lock
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error('账户已锁定，请稍后再试');
        }

        const isValid = await verifyPassword(
          credentials.password,
          user.passwordHash,
        );

        if (!isValid) {
          // Increment failed login attempts
          const newAttempts = user.failedLoginAttempts + 1;
          const updateData: { failedLoginAttempts: number; lockedUntil?: Date } =
            { failedLoginAttempts: newAttempts };

          // Lock after 5 failed attempts for 30 minutes
          if (newAttempts >= 5) {
            updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
          }

          await prisma.user.update({
            where: { id: user.id },
            data: updateData,
          });

          throw new Error('邮箱或密码错误');
        }

        // Reset failed attempts on successful login
        if (user.failedLoginAttempts > 0) {
          await prisma.user.update({
            where: { id: user.id },
            data: { failedLoginAttempts: 0, lockedUntil: null },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    CredentialsProvider({
      id: 'phone',
      name: 'Phone Verification',
      credentials: {
        phone: { label: 'Phone', type: 'text' },
        code: { label: 'Verification Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.phone || !credentials?.code) {
          throw new Error('请提供手机号和验证码');
        }

        const redisKey = `verify:phone:${credentials.phone}`;
        const isValid = await verifyCode(redisKey, credentials.code);

        if (!isValid) {
          throw new Error('验证码无效或已过期');
        }

        // Find or create user by phone
        let user = await prisma.user.findUnique({
          where: { phone: credentials.phone },
        });

        if (!user) {
          user = await prisma.user.create({
            data: {
              phone: credentials.phone,
              isPhoneVerified: true,
            },
          });
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
    WeChatProvider({
      clientId: process.env.WECHAT_CLIENT_ID ?? '',
      clientSecret: process.env.WECHAT_CLIENT_SECRET ?? '',
    }),
    LineProvider({
      clientId: process.env.LINE_CLIENT_ID ?? '',
      clientSecret: process.env.LINE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Only handle social OAuth sign-ins (not credentials)
      if (!account || account.type !== 'oauth') {
        return true;
      }

      const provider = account.provider; // 'wechat' or 'line'
      const providerId = account.providerAccountId;

      // Check if this social account is already linked
      const existingSocial = await prisma.socialAccount.findUnique({
        where: { provider_providerId: { provider, providerId } },
        include: { user: true },
      });

      if (existingSocial) {
        // Social account already linked — sign in as that user
        user.id = existingSocial.user.id;
        user.email = existingSocial.user.email;
        user.name = existingSocial.user.name;
        user.role = existingSocial.user.role;
        return true;
      }

      // Social account not yet linked — check if a user with the same email exists
      let localUser = user.email
        ? await prisma.user.findUnique({ where: { email: user.email } })
        : null;

      if (!localUser) {
        // Create a new user for this social login
        localUser = await prisma.user.create({
          data: {
            name: user.name,
            email: user.email,
            avatar: user.image,
          },
        });
      }

      // Link the social account to the local user
      await prisma.socialAccount.create({
        data: {
          userId: localUser.id,
          provider,
          providerId,
        },
      });

      // Update the user object so JWT callback gets the correct data
      user.id = localUser.id;
      user.email = localUser.email;
      user.name = localUser.name;
      user.role = localUser.role;

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.role = token.role;
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
};
