import { describe, it, expect } from 'vitest';
import { UserRole } from '@prisma/client';
import WeChatProvider from '@/lib/auth-providers/wechat';
import LineProvider from '@/lib/auth-providers/line';

describe('WeChatProvider', () => {
  const provider = WeChatProvider({
    clientId: 'test-wechat-app-id',
    clientSecret: 'test-wechat-app-secret',
  });

  it('should have correct provider id and type', () => {
    expect(provider.id).toBe('wechat');
    expect(provider.type).toBe('oauth');
    expect(provider.name).toBe('WeChat');
  });

  it('should use WeChat authorization URL', () => {
    const auth = provider.authorization as { url: string; params: Record<string, unknown> };
    expect(auth.url).toBe('https://open.weixin.qq.com/connect/qrconnect');
    expect(auth.params.appid).toBe('test-wechat-app-id');
    expect(auth.params.scope).toBe('snsapi_login');
  });

  it('should set clientId and clientSecret', () => {
    expect(provider.clientId).toBe('test-wechat-app-id');
    expect(provider.clientSecret).toBe('test-wechat-app-secret');
  });

  it('should map WeChat profile to NextAuth User', () => {
    const wechatProfile = {
      openid: 'wx-openid-123',
      nickname: '测试用户',
      sex: 1,
      province: '广东',
      city: '深圳',
      country: '中国',
      headimgurl: 'https://wx.qlogo.cn/test.jpg',
      privilege: [],
    };

    const user = provider.profile(wechatProfile, {} as any);
    expect(user.id).toBe('wx-openid-123');
    expect(user.name).toBe('测试用户');
    expect(user.image).toBe('https://wx.qlogo.cn/test.jpg');
    expect(user.role).toBe(UserRole.FREE_USER);
  });

  it('should have custom token endpoint handler', () => {
    const token = provider.token as { url: string; request: Function };
    expect(token.url).toBe('https://api.weixin.qq.com/sns/oauth2/access_token');
    expect(typeof token.request).toBe('function');
  });

  it('should have custom userinfo endpoint handler', () => {
    const userinfo = provider.userinfo as { url: string; request: Function };
    expect(userinfo.url).toBe('https://api.weixin.qq.com/sns/userinfo');
    expect(typeof userinfo.request).toBe('function');
  });
});

describe('LineProvider', () => {
  const provider = LineProvider({
    clientId: 'test-line-channel-id',
    clientSecret: 'test-line-channel-secret',
  });

  it('should have correct provider id and type', () => {
    expect(provider.id).toBe('line');
    expect(provider.type).toBe('oauth');
    expect(provider.name).toBe('Line');
  });

  it('should use Line authorization URL', () => {
    const auth = provider.authorization as { url: string; params: Record<string, unknown> };
    expect(auth.url).toBe('https://access.line.me/oauth2/v2.1/authorize');
    expect(auth.params.scope).toBe('profile openid');
  });

  it('should set clientId and clientSecret', () => {
    expect(provider.clientId).toBe('test-line-channel-id');
    expect(provider.clientSecret).toBe('test-line-channel-secret');
  });

  it('should map Line profile to NextAuth User', () => {
    const lineProfile = {
      userId: 'line-user-456',
      displayName: 'ทดสอบผู้ใช้',
      pictureUrl: 'https://profile.line-scdn.net/test.jpg',
      statusMessage: 'Hello',
    };

    const user = provider.profile(lineProfile, {} as any);
    expect(user.id).toBe('line-user-456');
    expect(user.name).toBe('ทดสอบผู้ใช้');
    expect(user.image).toBe('https://profile.line-scdn.net/test.jpg');
    expect(user.role).toBe(UserRole.FREE_USER);
  });

  it('should handle missing pictureUrl gracefully', () => {
    const lineProfile = {
      userId: 'line-user-789',
      displayName: 'No Avatar User',
    };

    const user = provider.profile(lineProfile as any, {} as any);
    expect(user.image).toBeNull();
  });

  it('should have custom token endpoint handler', () => {
    const token = provider.token as { url: string; request: Function };
    expect(token.url).toBe('https://api.line.me/oauth2/v2.1/token');
    expect(typeof token.request).toBe('function');
  });

  it('should have custom userinfo endpoint handler', () => {
    const userinfo = provider.userinfo as { url: string; request: Function };
    expect(userinfo.url).toBe('https://api.line.me/v2/profile');
    expect(typeof userinfo.request).toBe('function');
  });
});
