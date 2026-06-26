// AI 代理端点集成测试（Task 5）
// 覆盖 5 个 AI 代理端点：/api/ai/recognize、/beautify、/recommend、/voice/recognize、/sticker
// 测试兼容 weiji-ai 运行/未运行两种场景：
//   - 端点存在性用例断言 code ∈ {0, 503}（成功转发或降级）
//   - 降级专用用例通过 monkeypatch AiProxyService.forwardJson/forwardMultipart 强制抛错，断言 code === 503
//   - 健康检查用例直接读写 AiProxyService.aiStatus 静态字段，断言 /health 正确暴露状态

import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';
import { AiProxyService } from '../../src/service/ai-proxy.service';

// 5 个 AI 代理端点（与 src/controller/ai.controller.ts 路由一致）
const AI_ENDPOINTS = [
  { path: '/api/ai/recommend', kind: 'json' as const },
  { path: '/api/ai/recognize', kind: 'multipart' as const },
  { path: '/api/ai/beautify', kind: 'multipart' as const },
  { path: '/api/ai/voice/recognize', kind: 'multipart' as const },
  { path: '/api/ai/sticker', kind: 'multipart' as const },
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let request: any;
let token: string;

describe('AI 代理端点', () => {
  before(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  it('POST /api/ai/recommend 带 JWT 有响应（成功转发 code:0 或降级 code:503）', async () => {
    const res = await request
      .post('/api/ai/recommend')
      .set('Authorization', `Bearer ${token}`)
      .send({ dishName: '测试菜品' });
    // 路由处理器只设置 ctx.body，HTTP status 恒为 200
    assert.strictEqual(res.status, 200);
    // weiji-ai 在跑 → code:0；没跑/出错 → code:503
    assert.ok(
      res.body.code === 0 || res.body.code === 503,
      `code 应为 0 或 503，实际为 ${res.body.code}`
    );
    if (res.body.code === 0) {
      // 转发成功：透传 weiji-ai 的响应体，data 应存在
      assert.ok(res.body.data != null, '转发成功时 data 不应为 null');
    } else {
      // 降级：message 应提示 AI 服务不可用
      assert.match(res.body.message, /不可用/);
      assert.strictEqual(res.body.data, null);
    }
  });

  it('POST /api/ai/recommend 不带 JWT 返回 401 业务错误', async () => {
    const res = await request.post('/api/ai/recommend').send({ dishName: '测试' });
    // JWT 中间件直接设置 ctx.status = 401
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, 401);
    assert.strictEqual(res.body.data, null);
  });

  it('所有 5 个 AI 代理端点带 JWT 均响应（成功或降级，不崩溃）', async () => {
    for (const ep of AI_ENDPOINTS) {
      const res = await request
        .post(ep.path)
        .set('Authorization', `Bearer ${token}`)
        .send(ep.kind === 'json' ? { dishName: '测试' } : {});
      // 无论 weiji-ai 是否可用，端点都不应崩溃（500）或未认证（401）
      assert.strictEqual(res.status, 200, `${ep.path} 应返回 HTTP 200`);
      assert.ok(
        res.body.code === 0 || res.body.code === 503,
        `${ep.path} code 应为 0（转发成功）或 503（降级），实际为 ${res.body.code}`
      );
    }
  });

  it('所有 5 个 AI 代理端点未认证均返回 401', async () => {
    for (const ep of AI_ENDPOINTS) {
      const res = await request
        .post(ep.path)
        .send(ep.kind === 'json' ? { dishName: '测试' } : {});
      assert.strictEqual(res.status, 401, `${ep.path} 未认证应返回 401`);
      assert.strictEqual(res.body.code, 401, `${ep.path} 未认证 body.code 应为 401`);
    }
  });

  it('weiji-ai 不可用时 recommend 返回 503 降级（mock forwardJson 抛错）', async () => {
    // 方法 A：monkeypatch AiProxyService.forwardJson 静态方法强制抛错
    // 控制器调用 AiProxyService.forwardJson(ctx, path) 在运行时查找该方法，
    // 测试与控制器共享同一模块实例，故替换后控制器立即生效。
    const original = AiProxyService.forwardJson;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (AiProxyService as any).forwardJson = async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:8002 (mocked)');
    };
    try {
      const res = await request
        .post('/api/ai/recommend')
        .set('Authorization', `Bearer ${token}`)
        .send({ dishName: '测试' });
      // 降级：HTTP 200（路由处理器只设 body），body.code = 503
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.code, 503);
      assert.match(res.body.message, /不可用/);
      assert.strictEqual(res.body.data, null);
    } finally {
      // 恢复原始方法，避免影响后续测试
      AiProxyService.forwardJson = original;
    }
  });

  it('weiji-ai 不可用时 multipart 端点（recognize）返回 503 降级（mock forwardMultipart 抛错）', async () => {
    const original = AiProxyService.forwardMultipart;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (AiProxyService as any).forwardMultipart = async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:8002 (mocked)');
    };
    try {
      const res = await request
        .post('/api/ai/recognize')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.code, 503);
      assert.match(res.body.message, /不可用/);
      assert.strictEqual(res.body.data, null);
    } finally {
      AiProxyService.forwardMultipart = original;
    }
  });

  it('GET /health 反映 AI 服务连通状态（aiStatus up/down 均能正确暴露）', async () => {
    // createTestApp 不触发 checkHealth 定时任务，aiStatus 默认 down
    // 通过直接读写公开静态字段 AiProxyService.aiStatus 模拟两种状态
    const original = AiProxyService.aiStatus;
    try {
      // 场景 1：AI 服务不可用
      AiProxyService.aiStatus = 'down';
      let res = await request.get('/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.ai, 'down');

      // 场景 2：AI 服务可用
      AiProxyService.aiStatus = 'up';
      res = await request.get('/health');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.status, 'ok');
      assert.strictEqual(res.body.ai, 'up');
    } finally {
      AiProxyService.aiStatus = original;
    }
  });
});
