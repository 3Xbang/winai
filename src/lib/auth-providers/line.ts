import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers/oauth';
import { UserRole } from '@prisma/client';

/**
 * Line user profile returned from the profile endpoint.
 * @see https://developers.line.biz/en/docs/line-login/managing-users/
 */
export interface LineProfile {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}

/**
 * Custom Line OAuth Provider for NextAuth.js.
 * @see https://developers.line.biz/en/docs/line-login/integrate-line-login/
 */
export default function LineProvider(
  config: OAuthUserConfig<LineProfile>,
): OAuthConfig<LineProfile> {
  return {
    id: 'line',
    name: 'Line',
    type: 'oauth',
    checks: ['state'],

    authorization: {
      url: 'https://access.line.me/oauth2/v2.1/authorize',
      params: {
        scope: 'profile openid',
        response_type: 'code',
      },
    },

    token: {
      url: 'https://api.line.me/oauth2/v2.1/token',
      async request({ params, provider }) {
        const body = new URLSearchParams();
        body.set('grant_type', 'authorization_code');
        body.set('code', params.code as string);
        body.set('redirect_uri', provider.callbackUrl);
        body.set('client_id', provider.clientId!);
        body.set('client_secret', provider.clientSecret!);

        const response = await fetch('https://api.line.me/oauth2/v2.1/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: body.toString(),
        });

        const data = await response.json();

        if (data.error) {
          throw new Error(
            `Line token error: ${data.error} - ${data.error_description}`,
          );
        }

        return {
          tokens: {
            access_token: data.access_token,
            token_type: data.token_type,
            expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
            refresh_token: data.refresh_token,
            id_token: data.id_token,
          },
        };
      },
    },

    userinfo: {
      url: 'https://api.line.me/v2/profile',
      async request({ tokens }) {
        const response = await fetch('https://api.line.me/v2/profile', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });

        const data = await response.json();

        if (data.error) {
          throw new Error(
            `Line profile error: ${data.error} - ${data.error_description}`,
          );
        }

        return data;
      },
    },

    profile(profile) {
      return {
        id: profile.userId,
        name: profile.displayName,
        image: profile.pictureUrl ?? null,
        email: null,
        role: UserRole.FREE_USER,
      };
    },

    clientId: config.clientId,
    clientSecret: config.clientSecret,

    style: {
      logo: '/icons/line.svg',
      bg: '#06C755',
      text: '#fff',
    },
  };
}
