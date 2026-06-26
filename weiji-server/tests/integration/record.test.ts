// 美食记录控制器集成测试
// 覆盖端点：
//   - GET  /api/record/list        分页查询（带 JWT）
//   - GET  /api/record/list        无 JWT 返回 401
//   - POST /api/record             创建记录
//   - GET  /api/record/:id         查询单条
import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Record 控制器', () => {
  let token: string;
  let request: any;

  before(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  // GET /api/record/list 带 JWT 返回分页记录
  it('GET /api/record/list 带 JWT 返回 code:0 且 data.list 非空', async () => {
    const res = await request
      .get('/api/record/list?page=1&pageSize=20')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(Array.isArray(res.body.data.list), 'list 应为数组');
    assert.ok(res.body.data.list.length > 0, '种子记录应在列表中');
    assert.strictEqual(typeof res.body.data.total, 'number');
    assert.strictEqual(res.body.data.page, 1);
    assert.strictEqual(res.body.data.pageSize, 20);
  });

  // GET /api/record/list 不带 JWT 返回 401
  it('GET /api/record/list 不带 JWT 返回 401', async () => {
    const res = await request.get('/api/record/list');

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.code, 401);
    assert.strictEqual(res.body.data, null);
  });

  // POST /api/record 创建记录
  it('POST /api/record 创建记录返回 code:0 且包含新 id', async () => {
    const res = await request
      .post('/api/record')
      .set('Authorization', `Bearer ${token}`)
      .send({
        dishName: '集成测试-宫保鸡丁',
        cookingMethod: '炒',
        rating: 5,
        note: '测试创建的记录',
        mealType: '晚餐',
        tags: ['测试', '川菜'],
      });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.ok(res.body.data.id, '应返回新记录 id');
    assert.strictEqual(res.body.data.dishName, '集成测试-宫保鸡丁');
    assert.strictEqual(res.body.data.rating, 5);
    assert.deepStrictEqual(res.body.data.tags, ['测试', '川菜']);
    assert.strictEqual(res.body.data.userId, 'user-demo-0001');
    assert.strictEqual(res.body.data.isDeleted, false);
  });

  // POST /api/record 缺少 dishName 返回 400 业务错误
  it('POST /api/record 缺少 dishName 返回业务错误', async () => {
    const res = await request
      .post('/api/record')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 3 });

    assert.strictEqual(res.body.code, 400);
    assert.ok(res.body.message);
  });

  // GET /api/record/:id 查询单条（用刚创建的记录或种子数据 id）
  it('GET /api/record/:id 返回种子记录详情', async () => {
    const res = await request
      .get('/api/record/record-0001')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.strictEqual(res.body.data.id, 'record-0001');
    assert.strictEqual(res.body.data.dishName, '红烧牛肉面');
  });

  // GET /api/record/:id 不存在的 id 返回 404 业务错误
  it('GET /api/record/:id 不存在的 id 返回 404', async () => {
    const res = await request
      .get('/api/record/not-exist-id')
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.body.code, 404);
    assert.ok(res.body.message);
  });
});
