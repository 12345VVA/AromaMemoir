// 挑战控制器集成测试
// 覆盖端点：
//   - GET /api/challenge/list  挑战列表（仅返回 isActive=true 的挑战）
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Challenge 控制器', () => {
  let token: string;
  let request: any;

  before(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  // GET /api/challenge/list 挑战列表
  it('GET /api/challenge/list 返回处于激活状态的挑战数组', async () => {
    const res = await request
      .get('/api/challenge/list')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data), '挑战列表应为数组');
    assert.ok(res.body.data.length > 0, '种子挑战应非空');

    // 仅返回 isActive=true 的挑战
    for (const ch of res.body.data) {
      assert.strictEqual(ch.isActive, true, '列表中挑战应均为激活状态');
    }

    // 校验挑战结构
    const first = res.body.data[0];
    assert.ok(first.id, '应有 id');
    assert.ok(first.title, '应有 title');
    assert.ok(first.description, '应有 description');
    assert.ok(first.rules, '应有 rules');
    assert.ok(first.startDate, '应有 startDate');
    assert.ok(first.endDate, '应有 endDate');
  });

  // GET /api/challenge/list 无 JWT 返回 401
  it('GET /api/challenge/list 无 JWT 返回 401', async () => {
    const res = await request.get('/api/challenge/list');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, 401);
  });
});
