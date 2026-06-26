// 认证控制器
// 处理 /api/auth/login、/api/auth/register、/api/auth/logout
// 与前端 weiji-admin-web/src/api/client.ts 契约一致

import type { Context } from 'koa';
import { Controller, Post } from '../common/decorators';
import { ok, fail, type ApiResponse } from '../common/response';
import { AuthService } from '../service/auth.service';

@Controller('/api/auth')
export class AuthController {
  // POST /api/auth/login
  // body: { username, password }
  // 返回: ok({ token, user })
  @Post('/login')
  async login(ctx: Context): Promise<ApiResponse> {
    try {
      const { username, password } = (ctx.request.body || {}) as { username?: string; password?: string };
      const result = await AuthService.login(username || '', password || '');
      return ok(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '登录失败';
      return fail(message, 400);
    }
  }

  // POST /api/auth/register
  // body: { username, password, nickname }
  // 返回: ok({ token, user }) —— 注册成功后自动签发 token
  @Post('/register')
  async register(ctx: Context): Promise<ApiResponse> {
    try {
      const { username, password, nickname } = (ctx.request.body || {}) as {
        username?: string;
        password?: string;
        nickname?: string;
      };
      const result = await AuthService.register(username || '', password || '', nickname || '');
      return ok(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : '注册失败';
      return fail(message, 400);
    }
  }

  // POST /api/auth/logout
  // 无 body，后端空实现，前端清除 token 即可
  // 返回: ok(null, '退出成功')
  @Post('/logout')
  async logout(_ctx: Context): Promise<ApiResponse> {
    await AuthService.logout();
    return ok(null, '退出成功');
  }
}
