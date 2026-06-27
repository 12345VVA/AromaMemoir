// 埋点查询与上报控制器
// 处理 /api/analytics 下端点：
//   - GET  /api/analytics/events       查询埋点事件（支持 query.type 过滤）
//   - POST /api/analytics/track         前端上报事件（如 personality_share / timemachine_view）
// 与其他控制器一致：装饰器路由 + ok/fail 响应；JWT 中间件统一鉴权（不在白名单）。

import type { Context } from 'koa';
import { Controller, Get, Post } from '../common/decorators';
import { ok, fail, type ApiResponse } from '../common/response';
import { queryEvents, trackEvent, type AnalyticsEvent } from '../store/analytics';

// JWT 中间件挂载到 ctx.state.user 的用户信息
interface AuthUser {
  userId: string;
  username: string;
}

// 前端上报请求体
interface TrackBody {
  type?: string;
  payload?: Record<string, any>;
  familyId?: string;
}

@Controller('/api/analytics')
export class AnalyticsController {
  // GET /api/analytics/events
  // 查询埋点事件：读 query.type，无 type 时返回全部
  @Get('/events')
  async listEvents(ctx: Context): Promise<ApiResponse<AnalyticsEvent[]>> {
    const type = (ctx.query.type as string | undefined) || undefined;
    return ok(queryEvents(type));
  }

  // POST /api/analytics/track
  // 前端上报事件：接收 { type, payload?, familyId? }，鉴权后写入 analytics_events
  @Post('/track')
  async track(ctx: Context): Promise<ApiResponse<{ type: string }>> {
    const { userId } = ctx.state.user as AuthUser;
    const body = (ctx.request.body || {}) as TrackBody;
    if (!body.type || !body.type.trim()) {
      return fail('type 不能为空', 400);
    }
    trackEvent(body.type.trim(), userId, body.payload, body.familyId);
    return ok({ type: body.type.trim() }, '事件已记录');
  }
}
