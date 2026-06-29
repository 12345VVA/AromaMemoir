// 成就控制器集成测试
// 覆盖端点：
//   - GET /api/achievement/list   徽章列表（含是否解锁）
//   - GET /api/achievement/level  等级进度
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Achievement 控制器', () => {
  let token: string;
  let request: any;

  before(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  // GET /api/achievement/list 徽章列表
  it('GET /api/achievement/list 返回徽章列表且含 unlocked 字段', async () => {
    const res = await request
      .get('/api/achievement/list')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data), '徽章列表应为数组');
    assert.ok(res.body.data.length >= 6, '种子成就应有 6 枚');

    // demo 种子用户已解锁 ach-0001、ach-0002
    const firstRecord = res.body.data.find((a: any) => a.id === 'ach-0001');
    assert.ok(firstRecord, '应包含 first_record 成就');
    assert.strictEqual(firstRecord.unlocked, true);
    assert.ok(firstRecord.earnedAt, '已解锁成就应带 earnedAt');

    // 未解锁成就 unlocked=false 且 earnedAt=null
    const locked = res.body.data.find((a: any) => a.id === 'ach-0004');
    if (locked) {
      assert.strictEqual(locked.unlocked, false);
      assert.strictEqual(locked.earnedAt, null);
    }
  });

  // GET /api/achievement/level 等级进度
  it('GET /api/achievement/level 返回等级与进度数据', async () => {
    const res = await request
      .get('/api/achievement/level')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    const data = res.body.data;
    assert.strictEqual(typeof data.level, 'number');
    assert.strictEqual(typeof data.exp, 'number');
    assert.strictEqual(typeof data.nextLevelExp, 'number');
    assert.strictEqual(typeof data.progress, 'number');
    assert.ok(data.level >= 1, '等级至少为 1');
    assert.ok(data.exp >= 0, '经验值非负');
    assert.ok(data.progress >= 0 && data.progress <= 100, '进度百分比在 0-100');
    // demo 已解锁 ach-0001(50) + ach-0002(200) = 250 exp → level = floor(250/100)+1 = 3
    assert.strictEqual(data.exp, 250);
    assert.strictEqual(data.level, 3);
  });
});
