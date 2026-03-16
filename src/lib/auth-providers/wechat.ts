import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers/oauth';
import { UserRole } from '@prisma/client';

/**
 * WeChat user profile returned from the userinfo endpoint.
 * @see https://developers.weixin.qq.com/doc/oplatform/Website_App/WeChat_Login/Wechat_Login.html
 */
export interface WeChatProfile {
  openid: string;
  nickname: string;
  sex: number;
  province: string;
  city: string;
  country: string;
  headimgurl: string;
  privilege: string[];
  unionid?: string;
}

/**
 * Custom WeChat OAuth Provider for NextAuth.js.
 *
 * WeChat uses non-standard parameter names:
 * - `appid` instead of `client_id`
 * - `secret` instead of `client_secret`
 */
export default function WeChatProvider(
  config: OAuthUserConfig<WeChatProfile>,
): OAuthConfig<WeChatProfile> {
  return {
    id: 'wechat',
    name: 'WeChat',
    type: 'oauth',
    checks: ['state'],

    authorization: {
      url: 'https://open.weixin.qq.com/connect/qrconnect',
      params: {
        appid: config.clientId,
        response_type: 'code',
        scope: 'snsapi_login',
      },
    },

    token: {
      url: 'https://api.weixin.qq.com/sns/oauth2/access_token',
      async request({ params, provider }) {
        const url = new URL(
          'https://api.weixin.qq.com/sns/oauth2/access_token',
        );
        url.searchParams.set('appid', provider.clientId!);
        url.searchParams.set('secret', provider.clientSecret!);
        url.searchParams.set('code', params.code as string);
        url.searchParams.set('grant_type', 'authorization_code');

        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.errcode) {
          throw new Error(
            `WeChat token error: ${data.errcode} - ${data.errmsg}`,
          );
        }

        return {
          tokens: {
            access_token: data.access_token,
            token_type: 'bearer',
            expires_at: Math.floor(Date.now() / 1000) + data.expires_in,
            refresh_token: data.refresh_token,
            id_token: data.openid, // Store openid for profile lookup
          },
        };
      },
    },

    userinfo: {
      url: 'https://api.weixin.qq.com/sns/userinfo',
      async request({ tokens }) {
        const url = new URL('https://api.weixin.qq.com/sns/userinfo');
        url.searchParams.set('access_token', tokens.access_token as string);
        url.searchParams.set('openid', tokens.id_token as string);
        url.searchParams.set('lang', 'zh_CN');

        const response = await fetch(url.toString());
        const data = await response.json();

        if (data.errcode) {
          throw new Error(
            `WeChat userinfo error: ${data.errcode} - ${data.errmsg}`,
          );
        }

        return data;
      },
    },

    profile(profile) {
      return {
        id: profile.openid,
        name: profile.nickname,
        image: profile.headimgurl,
        email: null,
        role: UserRole.FREE_USER,
      };
    },

    clientId: config.clientId,
    clientSecret: config.clientSecret,

    style: {
      logo: '/icons/wechat.svg',
      bg: '#07C160',
      text: '#fff',
    },
  };
}
