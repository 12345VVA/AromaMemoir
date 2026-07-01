// 埋点端点集成测试（迁移自 weiji-server/tests/integration/analytics.test.ts）
//
// 适配说明：
// 1. 端点 /api/analytics/{events,track} → /app/analytics/{events,track}
// 2. 成功 code 0 → 1000；未鉴权 HTTP 401 → HTTP 200 + code:1001；
//    业务错误（缺 type）→ code:1001
// 3. C 端 token 不带 Bearer 前缀
// 4. 旧工程访问 /api/gamification/pokedex 会自动埋点 pokedex_view；新工程 gamification
//    控制器未自动埋点，故"访问 pokedex 后查 events?type=pokedex_view 返回 1 条"用例
//    改为：直接 POST /app/analytics/track 上报 pokedex_view 后按 type 查到
// 5. 旧工程 track 返回 data.type；新工程 track 返回上报的事件对象（含 type）
// 6. 旧工程事件 userId 为 'user-demo-0001'；新工程为数字（demo=1）
// 7. 旧工程事件字段 createdAt；新工程 BaseEntity 字段为 createTime
import { describe, it, beforeAll } from '@jest/globals';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Analytics 端点', () => {
  let token: string;
  let request: any;

  beforeAll(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  it('POST /app/analytics/track 上报 pokedex_view 后可按 type 查到', async () => {
    // 上报前确认 pokedex_view 数量
    const beforeRes = await request
      .get('/app/analytics/events?type=pokedex_view')
      .set('Authorization', token);
    expect(beforeRes.body.code).toBe(1000);
    const beforeCount = Array.isArray(beforeRes.body.data)
      ? beforeRes.body.data.length
      : 0;

    // 上报事件
    const trackRes = await request
      .post('/app/analytics/track')
      .set('Authorization', token)
      .send({
        type: 'pokedex_view',
        payload: { source: 'integration-test' },
      });
    expect(trackRes.status).toBe(200);
    expect(trackRes.body.code).toBe(1000);
    expect(trackRes.body.data.type).toBe('pokedex_view');

    // 查询应能查到刚上报的事件
    const afterRes = await request
      .get('/app/analytics/events?type=pokedex_view')
      .set('Authorization', token);
    expect(afterRes.body.code).toBe(1000);
    expect(Array.isArray(afterRes.body.data)).toBe(true);
    expect(afterRes.body.data.length).toBe(beforeCount + 1);

    // 校验最新事件字段
    const evt = afterRes.body.data[afterRes.body.data.length - 1];
    expect(evt.type).toBe('pokedex_view');
    expect(evt.id).toBeTruthy();
  });

  it('POST /app/analytics/track 缺 type 返回 code:1001', async () => {
    const res = await request
      .post('/app/analytics/track')
      .set('Authorization', token)
      .send({});
    expect(res.body.code).toBe(1001);
  });

  it('GET /app/analytics/events 无 token 返回 code:1001', async () => {
    const res = await request.get('/app/analytics/events');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });

  it('GET /app/analytics/events 无 type 参数返回全部事件数组', async () => {
    const res = await request
      .get('/app/analytics/events')
      .set('Authorization', token);
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(Array.isArray(res.body.data)).toBe(true);
    // 前面用例至少已上报 pokedex_view 1 条
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('POST /app/analytics/track 无 token 返回 code:1001', async () => {
    const res = await request
      .post('/app/analytics/track')
      .send({ type: 'timemachine_view' });
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });
});
