// AI 代理控制器
// 将 /api/ai/* 请求转发到 weiji-ai（:8002）对应 /ai/* 端点
// 与前端 weiji-admin-web/src/api/client.ts 契约一致：
//   - recognizeFood  → POST /api/ai/recognize  (multipart, image)
//   - beautifyImage  → POST /api/ai/beautify   (multipart, image)
//   - getRecommendations → POST /api/ai/recommend (JSON { dishName })
//   - voice/sticker 暂未在前端调用，本任务一并实现
//
// 降级策略：
//   - 所有 catch 块返回 { code: 503, data: null, message: '...' }
//   - 已用 try/catch 包裹，不抛异常到全局错误兜底
//   - 记录日志：console.error('[ai-proxy]', path, err.message)

import type { Context } from 'koa';
import { Controller, Post } from '../common/decorators';
import { fail, type ApiResponse } from '../common/response';
import { AiProxyService } from '../service/ai-proxy.service';

@Controller('/api/ai')
export class AiController {
  // POST /api/ai/recognize
  // multipart form-data, image 字段 → 转发到 weiji-ai /ai/recognize
  @Post('/recognize')
  async recognize(ctx: Context): Promise<ApiResponse> {
    try {
      return await AiProxyService.forwardMultipart(ctx, '/ai/recognize');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ai-proxy]', '/ai/recognize', message);
      return fail('AI 服务暂时不可用，请稍后重试', 503);
    }
  }

  // POST /api/ai/beautify
  // multipart form-data, image 字段 → 转发到 weiji-ai /ai/beautify
  @Post('/beautify')
  async beautify(ctx: Context): Promise<ApiResponse> {
    try {
      return await AiProxyService.forwardMultipart(ctx, '/ai/beautify');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ai-proxy]', '/ai/beautify', message);
      return fail('AI 服务暂时不可用，请稍后重试', 503);
    }
  }

  // POST /api/ai/recommend
  // JSON body { dishName } → 转发到 weiji-ai /ai/recommend
  @Post('/recommend')
  async recommend(ctx: Context): Promise<ApiResponse> {
    try {
      return await AiProxyService.forwardJson(ctx, '/ai/recommend');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ai-proxy]', '/ai/recommend', message);
      return fail('AI 服务暂时不可用，请稍后重试', 503);
    }
  }

  // POST /api/ai/voice/recognize
  // multipart form-data, audio 字段 → 转发到 weiji-ai /ai/voice/recognize
  @Post('/voice/recognize')
  async voiceRecognize(ctx: Context): Promise<ApiResponse> {
    try {
      return await AiProxyService.forwardMultipart(ctx, '/ai/voice/recognize');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ai-proxy]', '/ai/voice/recognize', message);
      return fail('AI 语音服务暂时不可用', 503);
    }
  }

  // POST /api/ai/sticker
  // multipart form-data, image 字段 → 转发到 weiji-ai /ai/sticker
  @Post('/sticker')
  async sticker(ctx: Context): Promise<ApiResponse> {
    try {
      return await AiProxyService.forwardMultipart(ctx, '/ai/sticker');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[ai-proxy]', '/ai/sticker', message);
      return fail('AI 贴纸服务暂时不可用', 503);
    }
  }
}
