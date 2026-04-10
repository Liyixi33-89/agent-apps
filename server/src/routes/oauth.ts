/**
 * @file routes/oauth.ts
 * @description OAuth 第三方登录路由 — 支持 GitHub / Google / 企业微信
 *
 * 路由列表：
 *   GET  /api/oauth/providers          → 获取可用的 OAuth Provider 列表
 *   GET  /api/oauth/github             → 跳转 GitHub 授权页
 *   GET  /api/oauth/github/callback    → GitHub 授权回调
 *   GET  /api/oauth/google             → 跳转 Google 授权页
 *   GET  /api/oauth/google/callback    → Google 授权回调
 *   GET  /api/oauth/wechat             → 跳转企业微信授权页
 *   GET  /api/oauth/wechat/callback    → 企业微信授权回调
 */

import Router from '@koa/router';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import { User } from '../models/User.js';
import { env } from '../config/env.js';

export const oauthRouter = new Router({ prefix: '/oauth' });

// ─── 工具函数：签发 JWT ───────────────────────────────────────────────────────

const signToken = (user: { _id: string; username: string; role: string }) => {
  return jwt.sign(
    { userId: user._id, username: user.username, role: user.role },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn } as any
  );
};

/**
 * 查找或创建 OAuth 用户
 */
const findOrCreateOAuthUser = async (
  provider: 'github' | 'google' | 'wechat',
  providerId: string,
  profile: { username: string; email: string; avatar?: string; accessToken?: string }
) => {
  // 1. 先按 OAuth provider + providerId 查找
  let user = await User.findOne({ 'oauth.provider': provider, 'oauth.providerId': providerId });

  if (user) {
    // 更新 accessToken 和最后登录时间
    user.oauth = { provider, providerId, accessToken: profile.accessToken };
    user.lastLoginAt = new Date();
    if (profile.avatar && !user.avatar) user.avatar = profile.avatar;
    await user.save();
    return user;
  }

  // 2. 按 email 查找（可能已有本地账号）
  if (profile.email) {
    user = await User.findOne({ email: profile.email });
    if (user) {
      // 绑定 OAuth 信息到已有账号
      user.oauth = { provider, providerId, accessToken: profile.accessToken };
      user.lastLoginAt = new Date();
      if (profile.avatar && !user.avatar) user.avatar = profile.avatar;
      await user.save();
      return user;
    }
  }

  // 3. 创建新用户
  // 确保 username 唯一
  let username = profile.username || `${provider}_${providerId.slice(0, 8)}`;
  const existing = await User.findOne({ username });
  if (existing) {
    username = `${username}_${Date.now().toString(36)}`;
  }

  user = await User.create({
    username,
    email: profile.email || `${username}@oauth.local`,
    passwordHash: 'oauth_no_password', // OAuth 用户无密码
    role: 'viewer',
    avatar: profile.avatar,
    oauth: { provider, providerId, accessToken: profile.accessToken },
    lastLoginAt: new Date(),
  });

  return user;
};

// ─── 获取可用的 OAuth Provider 列表 ──────────────────────────────────────────

oauthRouter.get('/providers', async (ctx) => {
  const providers: Array<{ key: string; name: string; icon: string; enabled: boolean }> = [
    {
      key: 'github',
      name: 'GitHub',
      icon: '🐙',
      enabled: !!(env.githubClientId && env.githubClientSecret),
    },
    {
      key: 'google',
      name: 'Google',
      icon: '🔍',
      enabled: !!(env.googleClientId && env.googleClientSecret),
    },
    {
      key: 'wechat',
      name: '企业微信',
      icon: '💬',
      enabled: !!(env.wechatCorpId && env.wechatCorpSecret),
    },
  ];

  ctx.body = { success: true, data: providers };
});

// ─── GitHub OAuth ────────────────────────────────────────────────────────────

oauthRouter.get('/github', async (ctx) => {
  if (!env.githubClientId) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'GitHub OAuth 未配置' };
    return;
  }

  const redirectUri = `${env.oauthCallbackBase}/api/oauth/github/callback`;
  const state = Math.random().toString(36).slice(2);
  const url = `https://github.com/login/oauth/authorize?client_id=${env.githubClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=user:email&state=${state}`;

  ctx.redirect(url);
});

oauthRouter.get('/github/callback', async (ctx) => {
  const { code, state } = ctx.query as Record<string, string>;
  if (!code) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少授权码' };
    return;
  }

  try {
    // 1. 用 code 换取 access_token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: env.githubClientId,
        client_secret: env.githubClientSecret,
        code,
        redirect_uri: `${env.oauthCallbackBase}/api/oauth/github/callback`,
      },
      { headers: { Accept: 'application/json' } }
    );
    const accessToken = tokenRes.data.access_token;
    if (!accessToken) throw new Error('获取 access_token 失败');

    // 2. 获取用户信息
    const userRes = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const ghUser = userRes.data;

    // 3. 获取邮箱（可能需要额外请求）
    let email = ghUser.email;
    if (!email) {
      try {
        const emailRes = await axios.get('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const primary = emailRes.data.find((e: any) => e.primary);
        email = primary?.email || emailRes.data[0]?.email;
      } catch { /* 忽略 */ }
    }

    // 4. 查找或创建用户
    const user = await findOrCreateOAuthUser('github', String(ghUser.id), {
      username: ghUser.login,
      email: email || `${ghUser.login}@github.oauth`,
      avatar: ghUser.avatar_url,
      accessToken,
    });

    // 5. 签发 JWT 并重定向到前端
    const token = signToken({ _id: String(user._id), username: user.username, role: user.role });
    ctx.redirect(`${env.clientOrigin}/oauth/callback?token=${token}&username=${user.username}&role=${user.role}`);
  } catch (err: unknown) {
    console.error('[OAuth] GitHub callback error:', err);
    ctx.redirect(`${env.clientOrigin}/oauth/callback?error=${encodeURIComponent('GitHub 登录失败')}`);
  }
});

// ─── Google OAuth ────────────────────────────────────────────────────────────

oauthRouter.get('/google', async (ctx) => {
  if (!env.googleClientId) {
    ctx.status = 400;
    ctx.body = { success: false, message: 'Google OAuth 未配置' };
    return;
  }

  const redirectUri = `${env.oauthCallbackBase}/api/oauth/google/callback`;
  const state = Math.random().toString(36).slice(2);
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${env.googleClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid%20email%20profile&state=${state}`;

  ctx.redirect(url);
});

oauthRouter.get('/google/callback', async (ctx) => {
  const { code } = ctx.query as Record<string, string>;
  if (!code) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少授权码' };
    return;
  }

  try {
    // 1. 用 code 换取 access_token
    const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: env.googleClientId,
      client_secret: env.googleClientSecret,
      code,
      redirect_uri: `${env.oauthCallbackBase}/api/oauth/google/callback`,
      grant_type: 'authorization_code',
    });
    const accessToken = tokenRes.data.access_token;
    if (!accessToken) throw new Error('获取 access_token 失败');

    // 2. 获取用户信息
    const userRes = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const gUser = userRes.data;

    // 3. 查找或创建用户
    const user = await findOrCreateOAuthUser('google', gUser.id, {
      username: gUser.name || gUser.email?.split('@')[0] || `google_${gUser.id}`,
      email: gUser.email,
      avatar: gUser.picture,
      accessToken,
    });

    const token = signToken({ _id: String(user._id), username: user.username, role: user.role });
    ctx.redirect(`${env.clientOrigin}/oauth/callback?token=${token}&username=${user.username}&role=${user.role}`);
  } catch (err: unknown) {
    console.error('[OAuth] Google callback error:', err);
    ctx.redirect(`${env.clientOrigin}/oauth/callback?error=${encodeURIComponent('Google 登录失败')}`);
  }
});

// ─── 企业微信 OAuth ──────────────────────────────────────────────────────────

oauthRouter.get('/wechat', async (ctx) => {
  if (!env.wechatCorpId) {
    ctx.status = 400;
    ctx.body = { success: false, message: '企业微信 OAuth 未配置' };
    return;
  }

  const redirectUri = `${env.oauthCallbackBase}/api/oauth/wechat/callback`;
  const state = Math.random().toString(36).slice(2);
  const url = `https://open.weixin.qq.com/connect/oauth2/authorize?appid=${env.wechatCorpId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=snsapi_base&state=${state}#wechat_redirect`;

  ctx.redirect(url);
});

oauthRouter.get('/wechat/callback', async (ctx) => {
  const { code } = ctx.query as Record<string, string>;
  if (!code) {
    ctx.status = 400;
    ctx.body = { success: false, message: '缺少授权码' };
    return;
  }

  try {
    // 1. 获取 access_token
    const tokenRes = await axios.get(
      `https://qyapi.weixin.qq.com/cgi-bin/gettoken?corpid=${env.wechatCorpId}&corpsecret=${env.wechatCorpSecret}`
    );
    const accessToken = tokenRes.data.access_token;
    if (!accessToken) throw new Error('获取企业微信 access_token 失败');

    // 2. 获取用户身份
    const userIdRes = await axios.get(
      `https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo?access_token=${accessToken}&code=${code}`
    );
    const userId = userIdRes.data.userid || userIdRes.data.UserId;
    if (!userId) throw new Error('获取用户身份失败');

    // 3. 获取用户详情
    const userDetailRes = await axios.get(
      `https://qyapi.weixin.qq.com/cgi-bin/user/get?access_token=${accessToken}&userid=${userId}`
    );
    const wxUser = userDetailRes.data;

    // 4. 查找或创建用户
    const user = await findOrCreateOAuthUser('wechat', userId, {
      username: wxUser.name || userId,
      email: wxUser.email || `${userId}@wechat.corp`,
      avatar: wxUser.avatar,
      accessToken,
    });

    const token = signToken({ _id: String(user._id), username: user.username, role: user.role });
    ctx.redirect(`${env.clientOrigin}/oauth/callback?token=${token}&username=${user.username}&role=${user.role}`);
  } catch (err: unknown) {
    console.error('[OAuth] WeChat callback error:', err);
    ctx.redirect(`${env.clientOrigin}/oauth/callback?error=${encodeURIComponent('企业微信登录失败')}`);
  }
});
