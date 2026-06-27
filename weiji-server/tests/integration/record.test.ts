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

  // PATCH /api/record/:id 更新自己的记录
  it('PATCH /api/record/:id 更新自己的记录返回 code:0', async () => {
    const res = await request
      .patch('/api/record/record-0001')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 3, note: '更新后的备注' });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.strictEqual(res.body.data.record.id, 'record-0001');
    assert.strictEqual(res.body.data.record.rating, 3);
    assert.strictEqual(res.body.data.record.note, '更新后的备注');
    assert.strictEqual(res.body.data.record.dishName, '红烧牛肉面'); // 未改字段保留
  });

  // PATCH /api/record/:id 更新他人记录返回 403
  it('PATCH /api/record/:id 更新他人记录返回 403', async () => {
    // 用 mom 用户登录
    const momLogin = await request
      .post('/api/auth/login')
      .send({ username: 'mom', password: '123456' });
    const momToken = momLogin.body.data.token;

    const res = await request
      .patch('/api/record/record-0001')
      .set('Authorization', `Bearer ${momToken}`)
      .send({ rating: 1 });

    assert.strictEqual(res.body.code, 403);
  });

  // PATCH /api/record/:id 不存在返回 404
  it('PATCH /api/record/:id 不存在返回 404', async () => {
    const res = await request
      .patch('/api/record/not-exist-id')
      .set('Authorization', `Bearer ${token}`)
      .send({ rating: 5 });

    assert.strictEqual(res.body.code, 404);
  });

  // DELETE /api/record/:id 删除自己的记录
  it('DELETE /api/record/:id 软删除自己的记录返回 code:0', async () => {
    // 先创建一条记录用于删除
    const createRes = await request
      .post('/api/record')
      .set('Authorization', `Bearer ${token}`)
      .send({ dishName: '待删除记录', rating: 1 });
    const recordId = createRes.body.data.id;

    const res = await request
      .delete('/api/record/' + recordId)
      .set('Authorization', `Bearer ${token}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.code, 0);
    assert.strictEqual(res.body.message, '删除成功');
  });

  // DELETE /api/record/:id 删除他人记录返回 403
  it('DELETE /api/record/:id 删除他人记录返回 403', async () => {
    const momLogin = await request
      .post('/api/auth/login')
      .send({ username: 'mom', password: '123456' });
    const momToken = momLogin.body.data.token;

    const res = await request
      .delete('/api/record/record-0001')
      .set('Authorization', `Bearer ${momToken}`);

    assert.strictEqual(res.body.code, 403);
  });
});
