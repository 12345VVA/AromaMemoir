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
import type { VoiceIntent } from '../store/types';

// 语音意图识别
// 根据关键词推断用户意图，供前端分流处理：
//   - text 为空 → unknown
//   - 包含"今天吃什么"类关键词 → what_to_cook
//   - 包含"怎么做"类关键词 → cooking_step
//   - 其他默认按菜谱搜索处理 → search_recipe
function detectVoiceIntent(text: string): VoiceIntent {
  if (!text || !text.trim()) {
    return 'unknown';
  }
  if (/今天|做什么|吃啥|吃啥呢|今晚/.test(text)) {
    return 'what_to_cook';
  }
  if (/怎么做|步骤|教我|做法/.test(text)) {
    return 'cooking_step';
  }
  return 'search_recipe';
}

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
  // 在原有 { text } 基础上注入 intent 字段，供前端分流处理
  @Post('/voice/recognize')
  async voiceRecognize(ctx: Context): Promise<ApiResponse> {
    try {
      const result = await AiProxyService.forwardMultipart(ctx, '/ai/voice/recognize');
      const text = (result.data as { text?: string } | null)?.text ?? '';
      const intent = detectVoiceIntent(text);
      return {
        code: result.code,
        message: result.message,
        data: { text, intent },
      };
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
