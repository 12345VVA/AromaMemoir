// koa-ratelimit v6 未自带类型声明，此处提供最小可用类型
import type { Context, Middleware } from 'koa';

declare namespace KoaRatelimit {
  interface Options {
    /** 限流驱动：memory 使用 Map，redis 使用 Redis 连接；默认 redis */
    driver?: 'memory' | 'redis';
    /** 限流时间窗口（毫秒），默认 1 小时 */
    duration?: number;
    /** 每个 id 在 duration 内的最大请求数，默认 2500 */
    max?: number;
    /** memory 驱动时传入 Map 实例；redis 驱动时传入 redis 连接 */
    db?: Map<unknown, unknown> | unknown;
    /** 标识请求的函数，返回 false 则跳过限流；默认 ctx => ctx.ip */
    id?: (ctx: Context) => string | false | Promise<string | false>;
    /** 自定义响应头名称 */
    headers?: {
      remaining?: string;
      reset?: string;
      total?: string;
    };
    /** 触发限流时的错误文案 */
    errorMessage?: string;
    /** 触发限流时的 HTTP 状态码，默认 429 */
    status?: number;
    /** 是否禁用响应头输出 */
    disableHeader?: boolean;
    /** 白名单函数，返回 true 则跳过限流 */
    whitelist?: (ctx: Context) => boolean | Promise<boolean>;
    /** 黑名单函数，返回 true 则直接 403 */
    blacklist?: (ctx: Context) => boolean | Promise<boolean>;
    /** 触发限流时是否调用 ctx.throw */
    throw?: boolean;
    /** 触发限流时的回调 */
    onLimited?: (ctx: Context) => void;
  }
}

declare function rateLimit(opts?: KoaRatelimit.Options): Middleware;

export = rateLimit;
