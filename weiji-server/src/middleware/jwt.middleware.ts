// JWT 认证中间件
// 从 Authorization: Bearer <token> 提取并校验 token
// 白名单路径直接放行（登录/注册/健康检查/CORS 预检）
// 校验通过后将 decoded payload 挂到 ctx.state.user 供下游使用

import type { Context, Next } from 'koa';
import jwt from 'jsonwebtoken';
import { appConfig } from '../configuration';
import { unauthorized } from '../common/response';

// 白名单：精确匹配 method + path 的请求跳过 JWT 校验
const WHITELIST: Array<{ method: string; path: string }> = [
  { method: 'GET', path: '/health' },
  { method: 'POST', path: '/api/auth/login' },
  { method: 'POST', path: '/api/auth/register' },
];

// 判断请求是否在白名单中
function isWhitelisted(method: string, path: string): boolean {
  // OPTIONS 预检请求一律放行（CORS 预检不携带 token）
  if (method === 'OPTIONS') return true;
  return WHITELIST.some((item) => item.method === method && item.path === path);
}

// JWT 认证中间件（导出为 koa 中间件函数）
export async function jwtMiddleware(ctx: Context, next: Next): Promise<void> {
  const method = ctx.method.toUpperCase();
  const path = ctx.path;

  // 白名单直接放行
  if (isWhitelisted(method, path)) {
    await next();
    return;
  }

  // 提取 Authorization header，期望格式：Bearer <token>
  const authHeader = ctx.header.authorization || '';
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    ctx.status = 401;
    ctx.body = unauthorized();
    return;
  }
  const token = parts[1];
  if (!token) {
    ctx.status = 401;
    ctx.body = unauthorized();
    return;
  }

  try {
    // 校验 token，过期/无效均会抛错
    const decoded = jwt.verify(token, appConfig.jwt.secret) as { userId: string; username: string };
    // 挂载到 ctx.state.user 供下游控制器使用
    ctx.state.user = { userId: decoded.userId, username: decoded.username };
    await next();
  } catch (_err) {
    // token 过期或无效，统一返回登录已过期
    ctx.status = 401;
    ctx.body = unauthorized('登录已过期');
  }
}
