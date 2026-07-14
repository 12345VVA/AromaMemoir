import { Middleware, Inject, IMiddleware } from '@midwayjs/core';
import { Context, NextFunction } from '@midwayjs/koa';
import { AiProxyService } from '../service/ai_proxy';

/**
 * AI 静态资源代理中间件
 * 将 GET /app/ai/static/** 流式转发到 weiji-ai /static/**
 *
 * 以全局中间件实现（而非 controller 路由）的原因：
 *   cool-eps 会扫描所有 midway 路由（含 :path(.*) 通配符），把 `path(.*)` 误解析为方法名，
 *   生成非法 TS，导致前端 eps 描述文件格式化失败（prettier "Parameter declaration expected"）。
 *   纯中间件不进入 midway 路由表，cool-eps 扫不到，从根上规避该问题。
 *
 * 挂在 ai 模块（order=3），位于 user 模块（order=0，/app/ token 校验）之前：
 *   命中 /app/ai/static/ 时直接流式响应、不调 next()，从而绕过 C 端登录鉴权，
 *   便于 <img src="/app/ai/static/..."> 匿名直引。
 */
const STATIC_PREFIX = '/app/ai/static/';

@Middleware()
export class AiStaticProxyMiddleware
  implements IMiddleware<Context, NextFunction>
{
  @Inject()
  aiProxyService: AiProxyService;

  resolve() {
    return async (ctx: Context, next: NextFunction) => {
      // 仅处理 GET /app/ai/static/**，其余请求放行至后续中间件/路由
      const path = ctx.path || '';
      if (ctx.method !== 'GET' || !path.startsWith(STATIC_PREFIX)) {
        return await next();
      }
      const filePath = path.slice(STATIC_PREFIX.length);
      try {
        const resp = await this.aiProxyService.fetchStaticFile(filePath);
        // 透传 Content-Type / Content-Length / Cache-Control
        const headers = resp.headers || {};
        const contentType = String(
          headers['content-type'] || 'application/octet-stream'
        );
        const cacheControl = String(
          headers['cache-control'] || 'public, max-age=31536000, immutable'
        );
        const contentLength = headers['content-length'];
        ctx.set('Content-Type', contentType);
        ctx.set('Cache-Control', cacheControl);
        if (contentLength != null) {
          ctx.set('Content-Length', String(contentLength));
        }
        ctx.status = resp.status || 200;
        // axios responseType:'stream' 返回的流交给 koa 自动 pipe，请求结束时关闭
        ctx.body = resp.data;
        return;
      } catch (err: any) {
        // 错误在中间件内就地处理，避免冒泡到 BaseTranslate 被改写为 JSON 响应
        const status = err?.response?.status;
        if (status === 404) {
          ctx.status = 404;
          ctx.body = 'Not Found';
          return;
        }
        ctx.logger?.error(
          '[ai-proxy] static proxy failed',
          filePath,
          err?.message ?? String(err)
        );
        ctx.status = 502;
        ctx.body = 'Bad Gateway';
        return;
      }
    };
  }
}
