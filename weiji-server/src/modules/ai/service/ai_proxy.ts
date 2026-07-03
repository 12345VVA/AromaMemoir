import { Config, Inject, Init, Provide, ILogger } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import axios, { AxiosResponse } from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';

// AI 代理请求超时时间（毫秒）
const AI_REQUEST_TIMEOUT = 30_000;
// 健康检查超时时间（毫秒）
const HEALTH_CHECK_TIMEOUT = 5_000;
// 健康检查轮询间隔（毫秒）
const HEALTH_CHECK_INTERVAL = 60_000;

// weiji-ai 返回的响应体格式（与 cool-admin 统一响应一致：{ code, data, message }）
type AiServiceResponse = {
  code: number;
  data: any;
  message: string;
};

// 语音意图类型
type VoiceIntent =
  | 'what_to_cook'
  | 'cooking_step'
  | 'search_recipe'
  | 'unknown';

// midway 上传文件信息（mode=file 时 data 为临时文件路径）
type UploadFile = {
  filename: string;
  fieldName: string;
  mimeType: string;
  data: string;
};

/**
 * AI 代理服务
 * 将 /app/ai/* 请求转发到 weiji-ai（FastAPI，:8002），处理超时与错误降级
 * 同时维护 AI 服务连通性状态，供 /open/health 端点暴露
 */
@Provide()
export class AiProxyService extends BaseService {
  @Config('module.ai')
  aiConfig: { url: string };

  @Inject()
  ctx: Context;

  @Inject()
  logger: ILogger;

  // AI 服务连通性状态，默认 down，待启动健康检查后更新
  aiStatus: 'up' | 'down' = 'down';

  // 健康检查定时器引用，用于销毁时清理
  private healthTimer: NodeJS.Timeout | null = null;

  /**
   * 启动时立即检查一次健康状态，并启动 60s 轮询
   */
  @Init()
  async startHealthCheck() {
    // 立即检查一次
    await this.healthCheck();
    // 启动 60s 轮询
    this.healthTimer = setInterval(() => {
      this.healthCheck().catch(err => {
        this.logger?.error('[ai-proxy] healthCheck loop error', err);
      });
    }, HEALTH_CHECK_INTERVAL);
  }

  /**
   * 服务销毁时清理定时器，避免资源泄漏
   */
  async onDestroy() {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
  }

  /**
   * 检查 weiji-ai 健康状态
   * 成功 → aiStatus='up'；失败 → aiStatus='down'
   */
  async healthCheck(): Promise<'up' | 'down'> {
    try {
      await axios.get(`${this.aiConfig.url}/health`, {
        timeout: HEALTH_CHECK_TIMEOUT,
      });
      this.aiStatus = 'up';
    } catch (err) {
      this.aiStatus = 'down';
      this.logger?.error(
        '[ai-proxy] checkHealth failed:',
        err instanceof Error ? err.message : String(err)
      );
    }
    return this.aiStatus;
  }

  /**
   * 转发请求到 weiji-ai
   * 失败处理策略：
   *   - 400/413/422（客户端请求问题：图片过大/格式错误/参数校验）→ 不标记 down，抛 CoolCommException
   *   - 401/403/404（配置/服务问题：鉴权/权限/端点缺失）→ 标记 down，抛 CoolCommException
   *   - 5xx（服务端错误）→ 标记 down，抛 CoolCommException
   *   - 网络错误/超时（无 response）→ 标记 down，抛 CoolCommException
   * @param path 转发路径，如 /ai/recognize
   * @param options 请求选项 { method, headers, body }
   */
  async forward(
    path: string,
    options: { method?: string; headers?: any; body?: any } = {}
  ): Promise<AiServiceResponse> {
    const { method = 'POST', headers = {}, body } = options;
    try {
      const response: AxiosResponse<AiServiceResponse> = await axios({
        url: `${this.aiConfig.url}${path}`,
        method,
        headers,
        data: body,
        timeout: AI_REQUEST_TIMEOUT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return response.data;
    } catch (err) {
      // 区分 4xx 客户端错误与 5xx/网络错误：
      // - 400/413/422 视为客户端请求问题（图片过大/格式错误/参数校验），不标记 down
      // - 401/403/404 视为配置/服务问题，标记 down
      // - 5xx 视为服务端问题，标记 down
      // - 网络错误/超时（无 response）标记 down
      const status = (err as any)?.response?.status;
      const noMarkDownStatuses = [400, 413, 422];
      if (!noMarkDownStatuses.includes(status)) {
        this.aiStatus = 'down';
      }
      this.logger?.error(
        '[ai-proxy] forward',
        path,
        err instanceof Error ? err.message : String(err),
        `status=${status ?? 'N/A'}`
      );
      throw new CoolCommException('AI 服务暂时不可用，请稍后重试');
    }
  }

  /**
   * 食物识别，转发 multipart image 到 /ai/recognize
   */
  async recognize(file: UploadFile): Promise<AiServiceResponse> {
    const form = this.buildMultipartForm(file, 'image');
    return this.forward('/ai/recognize', {
      body: form,
      headers: form.getHeaders(),
    });
  }

  /**
   * 图片美化，转发到 /ai/beautify
   */
  async beautify(file: UploadFile): Promise<AiServiceResponse> {
    const form = this.buildMultipartForm(file, 'image');
    return this.forward('/ai/beautify', {
      body: form,
      headers: form.getHeaders(),
    });
  }

  /**
   * 菜谱推荐，转发 JSON 到 /ai/recommend
   * body 透传 dishName / recentRecords / style 到 weiji-ai，供 LLM 参考用户历史
   */
  async recommend(
    body: { dishName: string; recentRecords?: string[]; style?: string }
  ): Promise<AiServiceResponse> {
    return this.forward('/ai/recommend', {
      body,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 语音识别，转发 multipart audio 到 /ai/voice/recognize
   * 重组响应：保留 weiji-ai 返回的 data.message（讯飞 ASR 原始 message），
   * 注入 intent 字段，回传 { text, message, intent }
   */
  async voiceRecognize(file: UploadFile): Promise<AiServiceResponse> {
    const form = this.buildMultipartForm(file, 'audio');
    const result = await this.forward('/ai/voice/recognize', {
      body: form,
      headers: form.getHeaders(),
    });
    const data = result?.data as { text?: string; message?: string } | null;
    const text = data?.text ?? '';
    const intent = this.detectVoiceIntent(text);
    return {
      code: result.code,
      message: result.message,
      data: { text, message: data?.message ?? '', intent },
    };
  }

  /**
   * 贴纸生成，转发到 /ai/sticker
   */
  async sticker(file: UploadFile): Promise<AiServiceResponse> {
    const form = this.buildMultipartForm(file, 'image');
    return this.forward('/ai/sticker', {
      body: form,
      headers: form.getHeaders(),
    });
  }

  /**
   * 构建 multipart/form-data 表单
   * @param file 上传文件信息
   * @param fieldName 表单字段名（image / audio）
   */
  private buildMultipartForm(file: UploadFile, fieldName: string): FormData {
    const form = new FormData();
    form.append(fieldName, fs.createReadStream(file.data), {
      filename: file.filename,
      contentType: file.mimeType,
    });
    return form;
  }

  /**
   * 语音意图识别
   * 根据关键词推断用户意图，供前端分流处理：
   *   - 包含「步骤/怎么做/做法」→ cooking_step
   *   - 包含「找/搜索/查」+菜名 → search_recipe
   *   - 包含「做/煮/炒/蒸/烤/炖」+食物名 → what_to_cook
   *   - 其他 → unknown
   */
  private detectVoiceIntent(text: string): VoiceIntent {
    if (!text || !text.trim()) {
      return 'unknown';
    }
    // 步骤/做法类优先匹配
    if (/步骤|怎么做|做法/.test(text)) {
      return 'cooking_step';
    }
    // 搜索类
    if (/找|搜索|查/.test(text)) {
      return 'search_recipe';
    }
    // 烹饪动词 + 食物名
    if (/做|煮|炒|蒸|烤|炖/.test(text)) {
      return 'what_to_cook';
    }
    return 'unknown';
  }
}
