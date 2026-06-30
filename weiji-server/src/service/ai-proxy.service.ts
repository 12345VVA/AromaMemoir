// AI 代理服务
// 将 /api/ai/* 请求转发到 weiji-ai（FastAPI，:8002），处理超时与错误降级
// 同时维护 AI 服务连通性状态，供 /health 端点暴露
//
// 设计要点：
// - koa-bodyparser 默认不解析 multipart/form-data，原始流保留在 ctx.req 上
//   因此 multipart 请求用 axios 直接传 ctx.req（Node IncomingMessage）+ 复制原始 headers，
//   下游 FastAPI 会按 multipart/form-data 正确解析
// - JSON 请求（/ai/recommend）已由 bodyparser 解析到 ctx.request.body，直接转发
// - 透传 weiji-ai 的响应体（已是 { code, data, message } 格式），不做二次包装

import type { Context } from 'koa';
import axios, { AxiosResponse } from 'axios';
import { appConfig } from '../configuration';

// 从请求头中仅提取白名单字段，过滤 Host / X-Forwarded-* / Cookie 等内部头
function pickHeaders(headers: Record<string, string | string[] | undefined>, allowlist: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const key of allowlist) {
    const v = headers[key];
    if (v !== undefined) {
      result[key] = Array.isArray(v) ? v.join(',') : String(v);
    }
  }
  return result;
}

// AI 服务连通性状态
export type AiStatus = 'up' | 'down';

// weiji-ai 返回的响应体格式（与 cool-admin 统一响应一致：{ code, data, message }）
export interface AiServiceResponse {
  code: number;
  data: unknown;
  message: string;
}

// AI 代理请求超时时间（毫秒）
const AI_REQUEST_TIMEOUT = 30_000;
// 健康检查超时时间（毫秒）
const HEALTH_CHECK_TIMEOUT = 5_000;

export class AiProxyService {
  // AI 服务连通性状态，默认 down，待启动健康检查后更新
  public static aiStatus: AiStatus = 'down';

  // 转发 multipart/form-data 请求
  // 直接将 ctx.req（Node IncomingMessage 流）作为 axios data，
  // 并复制原始 headers（含 Content-Type、Content-Length），下游 FastAPI 会按 multipart 解析
  static async forwardMultipart(ctx: Context, path: string): Promise<AiServiceResponse> {
    try {
      const response: AxiosResponse<AiServiceResponse> = await axios.post(
        `${appConfig.aiServiceUrl}${path}`,
        ctx.req,
        {
          headers: pickHeaders(ctx.headers, ['content-type', 'content-length', 'authorization']),
          timeout: AI_REQUEST_TIMEOUT,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        }
      );
      return response.data;
    } catch (err) {
      // 转发失败（网络错误/超时/4xx/5xx）标记 AI 服务不可用
      AiProxyService.aiStatus = 'down';
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ai-proxy] forwardMultipart', path, message);
      throw err;
    }
  }

  // 转发 JSON 请求（如 /ai/recommend）
  // bodyparser 已将请求体解析到 ctx.request.body，直接转发
  static async forwardJson(ctx: Context, path: string): Promise<AiServiceResponse> {
    try {
      const response: AxiosResponse<AiServiceResponse> = await axios.post(
        `${appConfig.aiServiceUrl}${path}`,
        ctx.request.body,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: AI_REQUEST_TIMEOUT,
        }
      );
      return response.data;
    } catch (err) {
      AiProxyService.aiStatus = 'down';
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ai-proxy] forwardJson', path, message);
      throw err;
    }
  }

  // 检查 weiji-ai 健康状态
  // 成功 → aiStatus='up'；失败 → aiStatus='down'
  // 返回最新状态，供 /health 端点读取
  static async checkHealth(): Promise<AiStatus> {
    try {
      await axios.get(`${appConfig.aiServiceUrl}/health`, {
        timeout: HEALTH_CHECK_TIMEOUT,
      });
      AiProxyService.aiStatus = 'up';
    } catch (err) {
      AiProxyService.aiStatus = 'down';
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ai-proxy] checkHealth failed:', message);
    }
    return AiProxyService.aiStatus;
  }
}
