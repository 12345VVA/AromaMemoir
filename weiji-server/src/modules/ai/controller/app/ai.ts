import { Body, Files, Inject, Post, Provide } from '@midwayjs/core';
import { CoolController, BaseController } from '@cool-midway/core';
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
   * multipart image → 转发 weiji-ai /ai/beautify
   */
  @Post('/beautify', { summary: '图片美化' })
  async beautify(@Files() files: any[]) {
    try {
      const file = files?.[0];
      if (!file) {
        return this.fail('上传文件为空', 400);
      }
      return await this.aiProxyService.beautify(file);
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
   * 菜谱推荐
   * JSON { dishName } → 转发 weiji-ai /ai/recommend
   */
  @Post('/recommend', { summary: '菜谱推荐' })
  async recommend(
    @Body() body: { dishName: string; recentRecords?: string[]; style?: string }
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
      return await this.aiProxyService.sticker(file);
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
