// 家庭组控制器集成测试
// 覆盖 7 类端点（路径按控制器实际定义，与 spec 描述有差异已适配）：
//   1. GET  /api/family                家庭信息（spec: /api/family/info）
//   2. GET  /api/family/members        成员列表
//   3. POST /api/family/invitations    生成邀请码（spec: /api/family/invite）
//   4. GET  /api/family/recipes        菜谱列表（spec: POST 创建菜谱；控制器仅提供查询，无创建端点）
//   5. GET  /api/family/menu           协作菜单
//   6. POST /api/family/menu/:id/vote  菜单项投票
//   7. GET  /api/family/shopping       购物清单（spec: /api/family/shopping-list）
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Family 控制器', () => {
  let token: string;
  let request: any;

  before(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  // 1. GET /api/family demo 用户的家庭信息
  it('GET /api/family 返回 demo 用户所属家庭组', async () => {
    const res = await request
      .get('/api/family')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(res.body.data, 'demo 用户应已加入家庭组');
    assert.strictEqual(res.body.data.id, 'family-0001');
    assert.strictEqual(res.body.data.name, '王家厨房');
    assert.strictEqual(res.body.data.ownerId, 'user-demo-0001');
    assert.strictEqual(res.body.data.memberCount, 4);
  });

  // 2. GET /api/family/members 成员列表
  it('GET /api/family/members 返回成员数组', async () => {
    const res = await request
      .get('/api/family/members')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data), '成员列表应为数组');
    assert.ok(res.body.data.length >= 4, '种子家庭组应有 4 名成员');
    // 校验成员结构
    const owner = res.body.data.find((m: any) => m.role === 'owner');
    assert.ok(owner, '应包含 owner 角色');
    assert.strictEqual(owner.userId, 'user-demo-0001');
    assert.ok(owner.nickname, '成员应带 nickname');
  });

  // 3. POST /api/family/invitations 生成邀请码
  it('POST /api/family/invitations 生成有效邀请码', async () => {
    const res = await request
      .post('/api/family/invitations')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(res.body.data.code, '应返回邀请码');
    assert.ok(res.body.data.expiresAt, '应返回过期时间');
    // 邀请码为 6 位大写字母+数字
    assert.match(res.body.data.code, /^[A-Z0-9]{6}$/);
  });

  // 4. GET /api/family/recipes 菜谱列表
  it('GET /api/family/recipes 返回家庭菜谱列表', async () => {
    const res = await request
      .get('/api/family/recipes')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data), '菜谱列表应为数组');
    assert.ok(res.body.data.length >= 4, '种子菜谱应有 4 道');
    // 校验菜谱字段
    const first = res.body.data[0];
    assert.ok(first.id);
    assert.ok(first.name);
    assert.ok(first.familyId, 'family-0001');
  });

  // 5. GET /api/family/menu 协作菜单
  it('GET /api/family/menu 返回本周菜单（按天/餐次排序）', async () => {
    const res = await request
      .get('/api/family/menu')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data), '菜单应为数组');
    assert.ok(res.body.data.length > 0, '种子菜单应非空');
    // 校验排序：dayOfWeek 升序
    for (let i = 1; i < res.body.data.length; i++) {
      const prev = res.body.data[i - 1];
      const cur = res.body.data[i];
      assert.ok(
        prev.dayOfWeek <= cur.dayOfWeek,
        '菜单应按 dayOfWeek 升序排列'
      );
    }
    // 校验菜单项结构
    const first = res.body.data[0];
    assert.ok(first.id);
    assert.ok(first.recipeId);
    assert.ok(first.recipeName);
    assert.ok(first.votes, '应含 votes 字段');
  });

  // 6. POST /api/family/menu/:id/vote 菜单项投票
  it('POST /api/family/menu/:id/vote 投票成功并返回票数', async () => {
    // 先 GET 拿到一个菜单项 id
    const menuRes = await request
      .get('/api/family/menu')
      .set('Authorization', `Bearer ${token}`);
    const menuItemId = menuRes.body.data[0].id;

    const res = await request
      .post(`/api/family/menu/${menuItemId}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: 'like' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.strictEqual(typeof res.body.data.likes, 'number');
    assert.strictEqual(typeof res.body.data.dislikes, 'number');
    // 首次 like 后 likes 至少为 1
    assert.ok(res.body.data.likes >= 1, 'like 后票数应增加');
  });

  // 6b. 投票参数非法返回业务错误
  it('POST /api/family/menu/:id/vote 非法 vote 参数返回 400', async () => {
    const menuRes = await request
      .get('/api/family/menu')
      .set('Authorization', `Bearer ${token}`);
    const menuItemId = menuRes.body.data[0].id;

    const res = await request
      .post(`/api/family/menu/${menuItemId}/vote`)
      .set('Authorization', `Bearer ${token}`)
      .send({ vote: 'invalid' });

    assert.strictEqual(res.body.code, 400);
    assert.ok(res.body.message);
  });

  // 7. GET /api/family/shopping 购物清单
  it('GET /api/family/shopping 返回购物清单数组', async () => {
    const res = await request
      .get('/api/family/shopping')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data), '购物清单应为数组');
    assert.ok(res.body.data.length >= 7, '种子购物清单应有 7 项');
    // 校验购物项结构
    const first = res.body.data[0];
    assert.ok(first.id);
    assert.ok(first.name);
    assert.ok(first.category);
    assert.strictEqual(typeof first.checked, 'boolean');
  });
});
