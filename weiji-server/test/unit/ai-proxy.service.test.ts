// AiProxyService 单元测试（迁移自 weiji-server/tests/unit/ai-proxy.service.test.ts）
//
// 适配说明：
// 1. 旧 AiProxyService 为静态方法（forwardMultipart/forwardJson），测试通过
//    monkeypatch axios.post 捕获 header 白名单过滤行为。
// 2. 新工程 AiProxyService（ai/service/ai_proxy.ts）为 cool-admin BaseService，
//    实例方法 forward / recognize / beautify / recommend / voiceRecognize /
//    sticker，转发失败抛 CoolCommException 并标记 aiStatus='down'。
// 3. 本文件通过 jest.mock('axios') 验证 forward 成功/降级，并通过 mock 实例
//    的 forward 方法验证各业务方法的转发与语音意图注入逻辑，不依赖 weiji-ai。
import * as axios from 'axios';
import { AiProxyService } from '../../src/modules/ai/service/ai_proxy';

// 自动 mock axios：源码 ai_proxy.ts 用 `import axios from 'axios'`，
// ts-jest（无 esModuleInterop）将其编译为 `axios_1.default(...)`，
// 故实际被调用的是 axios 模块的 default 导出。jest.mock 后 axios.default 即 jest.fn()。
jest.mock('axios');
const mockedAxios = (axios as any).default as jest.Mock;

function makeService() {
  const svc = new AiProxyService();
  (svc as any).aiConfig = { url: 'http://localhost:8002' };
  (svc as any).logger = {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  };
  return svc;
}

describe('AiProxyService.forward', () => {
  it('成功转发返回 weiji-ai 响应体', async () => {
    mockedAxios.mockResolvedValueOnce({
      data: { code: 1000, data: { result: 'ok' }, message: 'success' },
    });
    const svc = makeService();
    const r = await svc.forward('/ai/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: { dishName: 'x' },
    });
    expect(r.code).toBe(1000);
    expect(r.data).toEqual({ result: 'ok' });
    expect(mockedAxios).toHaveBeenCalled();
  });

  it('转发失败抛 CoolCommException 且 aiStatus=down', async () => {
    mockedAxios.mockRejectedValueOnce(
      new Error('connect ECONNREFUSED 127.0.0.1:8002'),
    );
    const svc = makeService();
    svc.aiStatus = 'up';
    await expect(svc.forward('/ai/recommend')).rejects.toThrow(/AI 服务暂时不可用/);
    expect(svc.aiStatus).toBe('down');
  });
});

describe('AiProxyService.recommend', () => {
  it('转发 JSON 到 /ai/recommend', async () => {
    const svc = makeService();
    (svc as any).forward = jest.fn().mockResolvedValue({
      code: 1000,
      data: { dish: '宫保鸡丁' },
      message: 'success',
    });
    const r = await svc.recommend({ dishName: '测试' });
    expect(r.code).toBe(1000);
    expect((svc as any).forward).toHaveBeenCalledWith(
      '/ai/recommend',
      expect.objectContaining({
        body: { dishName: '测试' },
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
});

describe('AiProxyService.voiceRecognize 意图注入', () => {
  it('含「怎么做」→ intent=cooking_step', async () => {
    const svc = makeService();
    (svc as any).forward = jest.fn().mockResolvedValue({
      code: 1000,
      data: { text: '红烧肉怎么做' },
      message: 'success',
    });
    const r = await svc.voiceRecognize({
      filename: 'a.mp3',
      fieldName: 'audio',
      mimeType: 'audio/mp3',
      data: '/tmp/a.mp3',
    });
    expect(r.data.intent).toBe('cooking_step');
    expect(r.data.text).toBe('红烧肉怎么做');
  });

  it('含「找」+菜名 → intent=search_recipe', async () => {
    const svc = makeService();
    (svc as any).forward = jest.fn().mockResolvedValue({
      code: 1000,
      data: { text: '帮我找一下番茄炒蛋' },
      message: 'success',
    });
    const r = await svc.voiceRecognize({
      filename: 'a.mp3',
      fieldName: 'audio',
      mimeType: 'audio/mp3',
      data: '/tmp/a.mp3',
    });
    expect(r.data.intent).toBe('search_recipe');
  });

  it('含「做」+食物 → intent=what_to_cook', async () => {
    const svc = makeService();
    (svc as any).forward = jest.fn().mockResolvedValue({
      code: 1000,
      data: { text: '今天想做面条' },
      message: 'success',
    });
    const r = await svc.voiceRecognize({
      filename: 'a.mp3',
      fieldName: 'audio',
      mimeType: 'audio/mp3',
      data: '/tmp/a.mp3',
    });
    expect(r.data.intent).toBe('what_to_cook');
  });

  it('空文本 → intent=unknown', async () => {
    const svc = makeService();
    (svc as any).forward = jest.fn().mockResolvedValue({
      code: 1000,
      data: { text: '' },
      message: 'success',
    });
    const r = await svc.voiceRecognize({
      filename: 'a.mp3',
      fieldName: 'audio',
      mimeType: 'audio/mp3',
      data: '/tmp/a.mp3',
    });
    expect(r.data.intent).toBe('unknown');
  });
});

describe('AiProxyService.aiStatus 默认值', () => {
  it('新实例 aiStatus 默认 down', () => {
    const svc = new AiProxyService();
    expect(svc.aiStatus).toBe('down');
  });
});
