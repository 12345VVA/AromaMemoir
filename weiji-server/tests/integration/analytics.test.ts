// 埋点查询与上报控制器集成测试
// 覆盖端点：
//   - GET  /api/analytics/events         查询埋点事件（支持 query.type 过滤）
//   - POST /api/analytics/track           前端上报事件
// 验证场景：
//   1. 访问 /api/gamification/pokedex 后查 events?type=pokedex_view 返回 1 条
//   2. POST /api/analytics/track 上报 timemachine_view 后可按 type 查到
// 测试隔离：Node test runner 每文件独立子进程，analytics_events 在本文件内累积；
//           为保证 "返回 1 条" 断言精确，仅在第一次访问 pokedex 后查询，且 timemachine_view 仅上报一次。
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Analytics 控制器', () => {
  let token: string;
  let request: any;

  before(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  // 1. 访问 pokedex 后查 events?type=pokedex_view 应返回 1 条
  it('访问 /api/gamification/pokedex 后 GET /api/analytics/events?type=pokedex_view 返回 1 条', async () => {
    // 触发 pokedex 端点（控制器内 trackEvent('pokedex_view', userId)）
    const pokedexRes = await request
      .get('/api/gamification/pokedex')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(pokedexRes.status, 200);
    assert.strictEqual(pokedexRes.body.code, 0);

    // 查询埋点事件
    const res = await request
      .get('/api/analytics/events?type=pokedex_view')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data), 'events 应为数组');
    assert.strictEqual(res.body.data.length, 1, '应返回 1 条 pokedex_view 事件');

    // 校验事件字段
    const evt = res.body.data[0];
    assert.strictEqual(evt.type, 'pokedex_view');
    assert.ok(evt.id, '事件应有 id');
    assert.ok(evt.createdAt, '事件应有 createdAt');
    assert.strictEqual(evt.userId, 'user-demo-0001');
  });

  // 2. POST /api/analytics/track 上报 timemachine_view 后可查到
  it('POST /api/analytics/track 上报 timemachine_view 后可按 type 查到', async () => {
    // 上报前确认 timemachine_view 数量为 0
    const beforeRes = await request
      .get('/api/analytics/events?type=timemachine_view')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(beforeRes.body.code, 0);
    const beforeCount = Array.isArray(beforeRes.body.data) ? beforeRes.body.data.length : 0;

    // 上报事件
    const trackRes = await request
      .post('/api/analytics/track')
      .set('Authorization', `Bearer ${token}`)
      .send({
        type: 'timemachine_view',
        payload: { source: 'integration-test' },
      });
    assert.strictEqual(trackRes.status, 200);
    assert.strictEqual(trackRes.body.code, 0);
    assert.strictEqual(trackRes.body.data.type, 'timemachine_view');

    // 查询应能查到刚上报的事件
    const afterRes = await request
      .get('/api/analytics/events?type=timemachine_view')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(afterRes.body.code, 0);
    assert.ok(Array.isArray(afterRes.body.data), 'events 应为数组');
    assert.strictEqual(
      afterRes.body.data.length,
      beforeCount + 1,
      '上报后 timemachine_view 事件应 +1',
    );

    // 校验最新事件字段
    const evt = afterRes.body.data[afterRes.body.data.length - 1];
    assert.strictEqual(evt.type, 'timemachine_view');
    assert.strictEqual(evt.userId, 'user-demo-0001');
    assert.ok(evt.id, '事件应有 id');
    assert.ok(evt.createdAt, '事件应有 createdAt');
    assert.deepStrictEqual(evt.payload, { source: 'integration-test' });
  });

  // 3. POST /api/analytics/track 缺 type 应返回 400
  it('POST /api/analytics/track 缺 type 返回 400', async () => {
    const res = await request
      .post('/api/analytics/track')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    assert.strictEqual(res.body.code, 400, '缺 type 应返回 400');
  });

  // 4. GET /api/analytics/events 无 JWT 返回 401
  it('GET /api/analytics/events 无 JWT 返回 401', async () => {
    const res = await request.get('/api/analytics/events');
    assert.strictEqual(res.status, 401);
  });

  // 5. GET /api/analytics/events 无 type 参数时返回全部事件
  it('GET /api/analytics/events 无 type 参数返回全部事件数组', async () => {
    const res = await request
      .get('/api/analytics/events')
      .set('Authorization', `Bearer ${token}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data), 'events 应为数组');
    // 前面用例至少已产生 pokedex_view(1) + timemachine_view(1) = 2 条
    assert.ok(res.body.data.length >= 2, '应至少包含前面上报的事件');
  });
});
