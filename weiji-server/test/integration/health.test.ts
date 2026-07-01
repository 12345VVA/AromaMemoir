// 健康检查端点集成测试（迁移自 weiji-server/tests/integration/health.test.ts）
//
// 适配说明：
// 1. 旧端点 GET /health → 新端点 GET /open/health（公开，无需鉴权）
// 2. 旧响应直接 { status, ai }；新工程 cool-admin 统一包装为
//    { code:1000, data:{ status, ai }, message:'success' }
// 3. ai 字段动态读取 AiProxyService.aiStatus（'up' | 'down'），测试仅断言枚举
import { describe, it } from '@jest/globals';
import { createTestApp } from '../helpers/app';

describe('GET /open/health', () => {
  it('应返回 code:1000 且 data.status=ok', async () => {
    const request = await createTestApp();
    const res = await request.get('/open/health');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(res.body.data.status).toBe('ok');
    // ai 字段可能是 'up' 或 'down'，验证枚举即可
    expect(['up', 'down']).toContain(res.body.data.ai);
  });
});
