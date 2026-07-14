import { Body, Files, Inject, Post, Provide } from '@midwayjs/core';
import {
  CoolController,
  BaseController,
} from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { AiProxyService } from '../../service/ai_proxy';

/**
 * C端 AI 代理
 * 将 /app/ai/* 请求转发到 weiji-ai，失败降级返回 code:503
 */
@Provide()
@CoolController({ api: [], prefix: '/app/ai', description: 'C端 AI 代理' })
export class AppAiController extends BaseController {
  @Inject()
  aiProxyService: AiProxyService;

  @Inject()
  ctx: Context;

  /**
   * 食物识别
   * multipart image → 转发 weiji-ai /ai/recognize
   */
  @Post('/recognize', { summary: '食物识别' })
  async recognize(@Files() files: any[]) {
    try {
      const file = files?.[0];
      if (!file) {
        return this.fail('上传文件为空', 400);
      }
      return await this.aiProxyService.recognize(file);
    } catch (err) {
      this.ctx.logger?.error(
        '[ai-proxy] /app/ai/recognize',
        err instanceof Error ? err.message : String(err)
      );
      return {
        code: 503,
        data: null,
        message: 'AI 服务暂时不可用，请稍后重试',
      };
    }
  }

  /**
   * 图片美化
   * multipart image + 可选 style 字段 → 转发 weiji-ai /ai/beautify
   */
  @Post('/beautify', { summary: '图片美化' })
  async beautify(@Files() files: any[]) {
    try {
      const file = files?.[0];
      if (!file) {
        return this.fail('上传文件为空', 400);
      }
      // multipart 中非文件字段在 @midwayjs/upload 下通过 ctx.request.body 取
      const fields = (this.ctx.request?.body || {}) as Record<string, any>;
      const style = typeof fields?.style === 'string' ? fields.style : undefined;
      return await this.aiProxyService.beautify(file, style);
    } catch (err) {
      this.ctx.logger?.error(
        '[ai-proxy] /app/ai/beautify',
        err instanceof Error ? err.message : String(err)
      );
      return {
        code: 503,
        data: null,
        message: 'AI 服务暂时不可用，请稍后重试',
      };
    }
  }

  /**
   * 菜谱推荐（多场景）
   * JSON { dishName?, scene?, familyId?, recentRecords?, style? } → 转发或本地查询
   * scene 取值：random(默认) / dinner / fridge / kids
   */
  @Post('/recommend', { summary: '菜谱推荐' })
  async recommend(
    @Body() body: {
      dishName?: string;
      recentRecords?: string[];
      style?: string;
      scene?: string;
      familyId?: number;
    }
  ) {
    try {
      return await this.aiProxyService.recommend(body);
    } catch (err) {
      this.ctx.logger?.error(
        '[ai-proxy] /app/ai/recommend',
        err instanceof Error ? err.message : String(err)
      );
      return {
        code: 503,
        data: null,
        message: 'AI 服务暂时不可用，请稍后重试',
      };
    }
  }

  /**
   * 语音识别
   * multipart audio → 转发 weiji-ai /ai/voice/recognize
   * server 注入 intent 字段后回传 { text, intent }
   */
  @Post('/voice/recognize', { summary: '语音识别' })
  async voiceRecognize(@Files() files: any[]) {
    try {
      const file = files?.[0];
      if (!file) {
        return this.fail('上传文件为空', 400);
      }
      return await this.aiProxyService.voiceRecognize(file);
    } catch (err) {
      this.ctx.logger?.error(
        '[ai-proxy] /app/ai/voice/recognize',
        err instanceof Error ? err.message : String(err)
      );
      return {
        code: 503,
        data: null,
        message: 'AI 语音服务暂时不可用',
      };
    }
  }

  /**
   * 贴纸生成
   * multipart image → 转发 weiji-ai /ai/sticker
   */
  @Post('/sticker', { summary: '贴纸生成' })
  async sticker(@Files() files: any[]) {
    try {
      const file = files?.[0];
      if (!file) {
        return this.fail('上传文件为空', 400);
      }
      const fields = (this.ctx.request?.body || {}) as Record<string, any>;
      const style = typeof fields?.style === 'string' ? fields.style : undefined;
      return await this.aiProxyService.sticker(file, style);
    } catch (err) {
      this.ctx.logger?.error(
        '[ai-proxy] /app/ai/sticker',
        err instanceof Error ? err.message : String(err)
      );
      return {
        code: 503,
        data: null,
        message: 'AI 贴纸服务暂时不可用',
      };
    }
  }

}
