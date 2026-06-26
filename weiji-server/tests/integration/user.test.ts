// 用户控制器集成测试
// 覆盖端点：
//   - GET /api/user/profile  当前登录用户档案 + 统计数据
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('User 控制器', () => {
  let token: string;
  let request: any;

  before(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  // GET /api/user/profile 返回 demo 用户档案 + 统计数据
  it('GET /api/user/profile 返回用户档案且不含 password', async () => {
    const res = await request
      .get('/api/user/profile')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    const data = res.body.data;

    // 基本档案字段
    assert.strictEqual(data.id, 'user-demo-0001');
    assert.strictEqual(data.username, 'demo');
    assert.strictEqual(data.nickname, '小明');
    assert.ok(data.avatar, '应有头像');
    assert.ok(data.createdAt, '应有创建时间');
    // 安全性：响应中不应包含 password 字段
    assert.strictEqual(data.password, undefined, '响应不得包含 password');

    // 统计数据
    assert.ok(data.stats, '应包含 stats 字段');
    assert.strictEqual(typeof data.stats.recordCount, 'number');
    assert.strictEqual(typeof data.stats.recipeCount, 'number');
    assert.strictEqual(typeof data.stats.streak, 'number');
    assert.strictEqual(typeof data.stats.achievementCount, 'number');
    // demo 种子用户有 3 条记录、上传 1 道菜谱（recipe-0001）、解锁 2 枚成就
    assert.ok(data.stats.recordCount >= 3, '记录数至少为种子 3 条');
    assert.ok(data.stats.recipeCount >= 1, '菜谱数至少为种子 1 道');
    assert.ok(data.stats.achievementCount >= 2, '成就数至少为种子 2 枚');
    assert.ok(data.stats.streak >= 0, 'streak 非负');
  });

  // GET /api/user/profile 无 JWT 返回 401
  it('GET /api/user/profile 无 JWT 返回 401', async () => {
    const res = await request.get('/api/user/profile');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, 401);
  });
});
