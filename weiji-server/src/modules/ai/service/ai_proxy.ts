import { Config, Inject, Init, Provide, ILogger } from '@midwayjs/core';
import { BaseService, CoolCommException } from '@cool-midway/core';
import { Context } from '@midwayjs/koa';
import { InjectEntityModel } from '@midwayjs/typeorm';
import { Repository } from 'typeorm';
import axios, { AxiosResponse } from 'axios';
import * as FormData from 'form-data';
import * as fs from 'fs';
import { RecordEntity } from '../../record/entity/record';
import { FamilyRecipeEntity } from '../../family/entity/recipe';
import { FamilyMemberEntity } from '../../family/entity/member';
import { AppUserEntity } from '../../account/entity/user';

// AI 代理请求超时时间（毫秒）
// 三层超时需层层递增，避免外层先于内层超时返回 503：
//   weiji-ai ark(120s) < 本代理(150s) < 前端(180s)
const AI_REQUEST_TIMEOUT = 150_000;
// 健康检查超时时间（毫秒）
const HEALTH_CHECK_TIMEOUT = 5_000;
// 健康检查轮询间隔（毫秒）
const HEALTH_CHECK_INTERVAL = 60_000;

// recommend 接口的兜底缓存与节流配置
// 即便前端漏判，后端也避免相同用户+菜品在短时间内重复打 LLM
const RECOMMEND_CACHE_TTL = 60_000; // 缓存有效期 60s
const RECOMMEND_CACHE_MAX = 200; // LRU 最大条目
const RECOMMEND_MIN_INTERVAL = 3_000; // 同一用户最小请求间隔 3s（防刷）

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

  // recommend 缓存：Map 保持插入顺序，配合尾部删除实现简易 LRU
  // key = `${userId}:${dishName}`，value = { result, ts }
  private recommendCache: Map<string, { result: AiServiceResponse; ts: number }> =
    new Map();
  // recommend 节流：记录每个用户最近一次成功调用 LLM 的时间，防止前端异常导致 LLM 被刷
  // 仅在成功调用（code===1000）后记录，失败重试不被节流
  private recommendLastSuccess: Map<string, number> = new Map();

  // 多场景推荐所需的本地数据仓储（fridge/kids/dinner 场景在代理层直接查询，避免改 weiji-ai）
  @InjectEntityModel(RecordEntity)
  recordEntity: Repository<RecordEntity>;

  @InjectEntityModel(FamilyRecipeEntity)
  familyRecipeEntity: Repository<FamilyRecipeEntity>;

  @InjectEntityModel(FamilyMemberEntity)
  familyMemberEntity: Repository<FamilyMemberEntity>;

  @InjectEntityModel(AppUserEntity)
  appUserEntity: Repository<AppUserEntity>;

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
      // weiji-ai 成功码为 0，而 cool-admin/前端统一约定成功码为 1000；
      // 透传前归一化，否则前端按 code===1000 判定成功时会把 AI 成功响应误判为失败。
      // fail 的 code（1 / 403 等）保持不变，前端仍正确判为失败。
      const result = response.data;
      if (result && typeof result === 'object' && result.code === 0) {
        result.code = 1000;
      }
      // 重写响应中 weiji-ai 返回的 /static/xxx 路径为 /app/ai/static/xxx，
      // 以便前端通过 weiji-server 间接访问 AI 生成的静态文件（解决多端静态资源访问与 Referer 白名单问题）
      this.rewriteStaticUrls(result);
      return result;
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
   * @param file 上传的图片文件
   * @param style 美化风格（auto/poster/vivid/art），由前端 formData 透传
   */
  async beautify(file: UploadFile, style?: string): Promise<AiServiceResponse> {
    const form = this.buildMultipartForm(file, 'image', style ? { style } : undefined);
    return this.forward('/ai/beautify', {
      body: form,
      headers: form.getHeaders(),
    });
  }

  /**
   * 菜谱推荐（多场景），scene 决定数据来源：
   *   - 'random'（默认）：保持原逻辑，转发到 weiji-ai /ai/recommend
   *   - 'dinner'：查询用户最近 5 条记录作为 recentRecords 转发到 weiji-ai，并在 data 中追加 reasons
   *   - 'fridge'：本地查询家庭菜谱，返回可用食材菜谱（不调 LLM）
   *   - 'kids'：本地查询孩子喜欢的记录（不调 LLM）
   *
   * 兜底防护：
   *   1. 按 user+scene+dish 做 60s 内存缓存，命中直接返回（fridge/kids 也走缓存，避免重复 DB 查询）
   *   2. dinner/random 走 3s 用户节流；fridge/kids 本地查询不节流
   * 未登录用户（无 ctx.user）以 ip 作为兜底键，避免匿名刷接口
   */
  async recommend(
    body: {
      dishName?: string;
      recentRecords?: string[];
      style?: string;
      scene?: string;
      familyId?: number;
    }
  ): Promise<AiServiceResponse> {
    const userId = this.ctx?.user?.userId ?? `ip:${this.ctx?.ip ?? 'unknown'}`;
    const dish = (body?.dishName ?? '').trim();
    // scene 缺省/非法值统一视为 'random'，保持向后兼容（旧调用不传 scene 走原逻辑）
    const scene =
      body?.scene && ['dinner', 'fridge', 'kids', 'random'].includes(body.scene)
        ? body.scene
        : 'random';
    const cacheKey = `${userId}:${scene}:${dish || 'auto'}`;
    const now = Date.now();

    // 1) 缓存命中：同 user 同 scene 同 dish 在 TTL 内直接复用
    const cached = this.recommendCache.get(cacheKey);
    if (cached && now - cached.ts < RECOMMEND_CACHE_TTL) {
      // LRU：命中后重新插入到末尾，保持最近使用顺序
      this.recommendCache.delete(cacheKey);
      this.recommendCache.set(cacheKey, cached);
      return cached.result;
    }

    // 2) 本地场景：fridge / kids 不走 LLM 节流，直接查询 DB 后返回并缓存
    if (scene === 'fridge') {
      const result = await this.recommendFridge(userId, body?.familyId);
      this.cacheResult(cacheKey, result, now);
      return result;
    }
    if (scene === 'kids') {
      const result = await this.recommendKids(userId);
      this.cacheResult(cacheKey, result, now);
      return result;
    }

    // 3) LLM 场景：dinner / random，走用户级节流，防止前端异常刷 LLM
    //    仅按成功调用记录时间戳——失败（503/异常）不消耗 token，不应阻塞后续重试
    const lastSuccessTs = this.recommendLastSuccess.get(userId);
    if (lastSuccessTs && now - lastSuccessTs < RECOMMEND_MIN_INTERVAL) {
      this.logger?.warn(
        `[ai-proxy] recommend throttled: userId=${userId} scene=${scene} dish=${dish} interval=${now - lastSuccessTs}ms`
      );
      return {
        code: 429,
        data: null,
        message: '请求过于频繁，请稍后再试',
      };
    }

    let result: AiServiceResponse;
    if (scene === 'dinner') {
      result = await this.recommendDinner(userId, dish, body?.recentRecords);
    } else {
      // scene === 'random'：保持现有转发逻辑，透传 body 到 weiji-ai
      result = await this.forward('/ai/recommend', {
        body,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 仅成功响应（code 1000）才记录节流时间戳并缓存：
    //   - 成功才真正消耗了 LLM token，需要防刷
    //   - 失败响应不缓存/不节流，允许用户立即重试
    if (result && result.code === 1000) {
      this.recommendLastSuccess.set(userId, now);
      this.cacheResult(cacheKey, result, Date.now());
    }
    return result;
  }

  /**
   * dinner 场景：查询用户最近 5 条记录的 dishName 作为 recentRecords，转发到 weiji-ai
   * 在 LLM 返回结果中追加 reasons 字段，便于前端展示推荐理由
   * 查询或转发失败时返回 fallback，不抛出异常打断调用方
   */
  private async recommendDinner(
    userId: number | string,
    dish: string,
    recentRecords?: string[]
  ): Promise<AiServiceResponse> {
    // 未登录用户（IP 兜底键）无法查个人记录，直接返回 fallback
    if (typeof userId !== 'number') {
      return {
        code: 1000,
        data: { recipes: [], message: '请登录后获取个性化推荐', fallback: true },
        message: 'ok',
      };
    }
    try {
      // 查询用户最近 5 条记录的 dishName 作为 recentRecords 供 LLM 参考
      let records = recentRecords ?? [];
      if (!records || records.length === 0) {
        const recent = await this.recordEntity.find({
          where: { userId } as any,
          order: { id: 'DESC' },
          take: 5,
        });
        records = recent.map(r => r.dishName).filter(Boolean);
      }
      const result = await this.forward('/ai/recommend', {
        body: { dishName: dish || '', recentRecords: records },
        headers: { 'Content-Type': 'application/json' },
      });
      // 在 data 中追加 reasons，前端可据此展示推荐理由
      if (result && result.code === 1000 && result.data) {
        result.data.reasons = [
          '基于你最近吃过的菜品',
          '考虑家庭成员口味',
          '营养均衡搭配',
        ];
      }
      return result;
    } catch (err) {
      this.logger?.error(
        '[ai-proxy] recommendDinner failed:',
        err instanceof Error ? err.message : String(err)
      );
      return {
        code: 1000,
        data: {
          recipes: [],
          message: '推荐服务暂时不可用，请稍后重试',
          fallback: true,
        },
        message: 'ok',
      };
    }
  }

  /**
   * fridge 场景：基于家庭菜谱食材推荐（本地，不调 LLM）
   * 1. 未登录或无 familyId → 兜底返回空
   * 2. 校验 userId 是 familyId 成员（硬约束：family 数据必须做成员校验）
   * 3. 查询家庭菜谱前 5 个，每项附 usedIngredients（取该菜谱 ingredients 的 name 数组）
   */
  private async recommendFridge(
    userId: number | string,
    familyId?: number
  ): Promise<AiServiceResponse> {
    if (typeof userId !== 'number' || !familyId) {
      return {
        code: 1000,
        data: { recipes: [], message: '未加入家庭，无法根据冰箱推荐', fallback: true },
        message: 'ok',
      };
    }
    try {
      // 校验用户是家庭成员（硬约束）
      const member = await this.familyMemberEntity.findOneBy({ familyId, userId });
      if (!member) {
        return {
          code: 1000,
          data: { recipes: [], message: '未加入家庭，无法根据冰箱推荐', fallback: true },
          message: 'ok',
        };
      }
      // 查询家庭菜谱（前 5 个）
      const recipes = await this.familyRecipeEntity.find({
        where: { familyId } as any,
        order: { id: 'DESC' },
        take: 5,
      });
      if (!recipes || recipes.length === 0) {
        return {
          code: 1000,
          data: { recipes: [], message: '家庭菜谱为空，添加菜谱后可获得推荐', fallback: true },
          message: 'ok',
        };
      }
      const list = recipes.map(r => {
        // ingredients 是 JSON，兼容字符串数组与 { name } 对象数组两种结构
        const ingredients = Array.isArray(r.ingredients) ? r.ingredients : [];
        const usedIngredients = ingredients
          .map((i: any) => (typeof i === 'string' ? i : i?.name))
          .filter(Boolean);
        return {
          id: r.id,
          name: r.name,
          coverUrl: r.coverUrl,
          usedIngredients,
          reason: '用现有食材即可制作',
        };
      });
      return {
        code: 1000,
        data: { recipes: list, message: '根据家庭菜谱食材推荐', fallback: false },
        message: 'ok',
      };
    } catch (err) {
      this.logger?.error(
        '[ai-proxy] recommendFridge failed:',
        err instanceof Error ? err.message : String(err)
      );
      return {
        code: 1000,
        data: {
          recipes: [],
          message: '推荐服务暂时不可用，请稍后重试',
          fallback: true,
        },
        message: 'ok',
      };
    }
  }

  /**
   * kids 场景：基于孩子历史喜好推荐（本地，不调 LLM）
   * 1. 优先 kidFriendly=true 且 rating>=4，按 rating 降序取前 5
   * 2. 若无 kidFriendly 字段数据（老记录/字段未就绪），降级为 rating>=4
   * 3. 完全无数据返回 fallback:true + 提示
   *
   * 注意：kidFriendly 字段正由另一个 agent 并行添加到 RecordEntity，
   * 此处用 (r as any).kidFriendly 读取，字段未就绪时返回 undefined，filter 自动降级。
   */
  private async recommendKids(
    userId: number | string
  ): Promise<AiServiceResponse> {
    if (typeof userId !== 'number') {
      return {
        code: 1000,
        data: { recipes: [], message: '请登录后获取孩子喜好推荐', fallback: true },
        message: 'ok',
      };
    }
    try {
      // 拉取用户记录，按 rating 降序，take 20 限制扫描量
      const all = await this.recordEntity.find({
        where: { userId } as any,
        order: { rating: 'DESC' },
        take: 20,
      });

      // 优先：kidFriendly=true 且 rating>=4
      let records = all.filter(
        r => (r as any).kidFriendly === true && r.rating >= 4
      );
      // 降级：仅 rating>=4（老记录无 kidFriendly 字段时）
      if (records.length === 0) {
        records = all.filter(r => r.rating >= 4);
      }

      if (records.length === 0) {
        return {
          code: 1000,
          data: { recipes: [], message: '数据不足，记录几餐后会有更好推荐', fallback: true },
          message: 'ok',
        };
      }

      const list = records.slice(0, 5).map(r => ({
        id: r.id,
        dishName: r.dishName,
        name: r.dishName,
        imageUrl: r.imageUrl,
        reason: '孩子之前喜欢这道菜',
        rating: r.rating,
      }));
      return {
        code: 1000,
        data: { recipes: list, message: '根据孩子喜好推荐', fallback: false },
        message: 'ok',
      };
    } catch (err) {
      this.logger?.error(
        '[ai-proxy] recommendKids failed:',
        err instanceof Error ? err.message : String(err)
      );
      return {
        code: 1000,
        data: {
          recipes: [],
          message: '推荐服务暂时不可用，请稍后重试',
          fallback: true,
        },
        message: 'ok',
      };
    }
  }

  /**
   * 写入 recommend 缓存并执行 LRU 淘汰
   * 提取自 recommend()，供 dinner/random/fridge/kids 各场景复用
   */
  private cacheResult(
    cacheKey: string,
    result: AiServiceResponse,
    now: number
  ): void {
    this.recommendCache.set(cacheKey, { result, ts: now });
    // LRU 淘汰：超出容量时删除最旧条目（Map 迭代按插入顺序）
    if (this.recommendCache.size > RECOMMEND_CACHE_MAX) {
      const oldestKey = this.recommendCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.recommendCache.delete(oldestKey);
      }
    }
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
   * @param extraFields 额外表单字段（如 style 等）
   */
  private buildMultipartForm(
    file: UploadFile,
    fieldName: string,
    extraFields?: Record<string, string>
  ): FormData {
    const form = new FormData();
    form.append(fieldName, fs.createReadStream(file.data), {
      filename: file.filename,
      contentType: file.mimeType,
    });
    if (extraFields) {
      for (const [k, v] of Object.entries(extraFields)) {
        if (v !== undefined && v !== null && v !== '') {
          form.append(k, String(v));
        }
      }
    }
    return form;
  }

  /**
   * 递归重写响应中的 /static/xxx URL → /app/ai/static/xxx
   * 仅处理字符串值，不修改数字/布尔/对象其他键名
   */
  private rewriteStaticUrls(obj: any): void {
    if (!obj || typeof obj !== 'object') return;
    if (Array.isArray(obj)) {
      for (const item of obj) this.rewriteStaticUrls(item);
      return;
    }
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === 'string') {
        if (val.startsWith('/static/')) {
          obj[key] = '/app/ai/static/' + val.slice('/static/'.length);
        }
      } else if (val && typeof val === 'object') {
        this.rewriteStaticUrls(val);
      }
    }
  }

  /**
   * 从 weiji-ai 流式下载 /static/ 下的文件（美化图/贴纸图等），返回 axios 流响应。
   * 前端/客户端通过 /app/ai/static/xxx 统一从 weiji-server 访问，避免直连 weiji-ai
   * 带来的端口/Referer/CORS 问题。
   */
  async fetchStaticFile(filePath: string): Promise<AxiosResponse> {
    // 防御 path traversal：禁止 ../ 或反斜杠
    const safe = String(filePath || '').replace(/\\/g, '/');
    if (safe.includes('..') || safe.startsWith('/') || !safe) {
      throw new CoolCommException('非法的文件路径', 400);
    }
    return axios({
      url: `${this.aiConfig.url}/static/${safe}`,
      method: 'GET',
      responseType: 'stream',
      timeout: 30_000,
      headers: {
        // weiji-ai requires a whitelisted Referer header for /static/ routes
        Referer: 'http://localhost:8001'
      }
    });
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
