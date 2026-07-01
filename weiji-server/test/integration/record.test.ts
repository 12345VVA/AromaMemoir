// 美食记录端点集成测试（迁移自 weiji-server/tests/integration/record.test.ts）
//
// 适配说明：
// 1. 端点 /api/record/list → /app/record/list；POST /api/record → POST /app/record/save；
//    GET /api/record/:id → /app/record/:id
// 2. 成功 code 0 → 1000；未鉴权 HTTP 401 → HTTP 200 + code:1001；
//    业务错误（缺 dishName / IDOR 403 / 不存在 404）→ code:1001（CoolCommException）
// 3. C 端 token 不带 Bearer 前缀
// 4. 旧工程记录 id 为字符串 'record-0001'；新工程主键为 bigint 自增（种子记录 id=1）
// 5. 旧工程 POST /api/record 直接返回记录对象；新工程 POST /app/record/save 返回
//    { record:{...}, newAchievements:[] }（record 包在 data.record 内）
// 6. 旧工程记录 userId 为 'user-demo-0001'；新工程 userId 为数字（demo=1）
// 7. 新工程 GET /app/record/:id 不存在时 service 返回 null → 响应
//    { code:1000, message:'success' }（无 data），故 404 用例改为断言 data 为空
import { describe, it, beforeAll } from '@jest/globals';
import { createTestApp } from '../helpers/app';
import { loginAsDemo } from '../helpers/auth';

describe('Record 端点', () => {
  let token: string;
  let request: any;

  beforeAll(async () => {
    request = await createTestApp();
    token = await loginAsDemo();
  });

  it('GET /app/record/list 带 token 返回分页记录', async () => {
    const res = await request
      .get('/app/record/list?page=1&pageSize=20')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(Array.isArray(res.body.data.list)).toBe(true);
    expect(res.body.data.list.length).toBeGreaterThan(0);
    expect(typeof res.body.data.total).toBe('number');
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.pageSize).toBe(20);
    // 列表按 createTime 降序；种子记录（id=1 红烧牛肉面）可能不在首位
    // （历史测试运行可能已创建更多记录），仅断言种子记录存在于列表中
    const seed = res.body.data.list.find(
      (r: any) => r.id === 1 || r.dishName === '红烧牛肉面',
    );
    expect(seed).toBeTruthy();
    expect(seed.dishName).toBe('红烧牛肉面');
  });

  it('GET /app/record/list 无 token 返回 code:1001', async () => {
    const res = await request.get('/app/record/list');
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1001);
  });

  it('POST /app/record/save 创建记录返回 data.record 包含新 id', async () => {
    const res = await request
      .post('/app/record/save')
      .set('Authorization', token)
      .send({
        dishName: '集成测试-宫保鸡丁',
        cookingMethod: '炒',
        rating: 5,
        note: '测试创建的记录',
        mealType: '晚餐',
        tags: ['测试', '川菜'],
      });

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    // 新工程 record 包在 data.record 内
    expect(res.body.data.record).toBeTruthy();
    expect(res.body.data.record.id).toBeTruthy();
    expect(res.body.data.record.dishName).toBe('集成测试-宫保鸡丁');
    expect(res.body.data.record.rating).toBe(5);
    expect(res.body.data.record.tags).toEqual(['测试', '川菜']);
    expect(res.body.data.record.userId).toBe(1);
    // newAchievements 占位字段
    expect(Array.isArray(res.body.data.newAchievements)).toBe(true);
  });

  it('POST /app/record/save 缺 dishName 返回 code:1001 业务错误', async () => {
    const res = await request
      .post('/app/record/save')
      .set('Authorization', token)
      .send({ rating: 3 });

    expect(res.body.code).toBe(1001);
    expect(res.body.message).toBeTruthy();
  });

  it('GET /app/record/:id 返回种子记录详情', async () => {
    const res = await request
      .get('/app/record/1')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.dishName).toBe('红烧牛肉面');
  });

  it('GET /app/record/:id 不存在的 id 返回 code:1000 且 data 为空（service 返回 null）', async () => {
    const res = await request
      .get('/app/record/999999')
      .set('Authorization', token);
    // service.get 找不到记录返回 null → 控制器 ok(null) → data 为空
    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    // data 为 null 或 undefined
    expect(res.body.data == null).toBe(true);
  });

  it('IDOR 防护：其他用户访问 demo 的记录被拒绝（code !== 1000）', async () => {
    // 注册一个全新用户 B（用户名限 alphanumeric）
    const username = 'idoruser' + Date.now();
    const regRes = await request.post('/app/account/register').send({
      username,
      password: 'test1234',
      nickName: 'idor',
    });
    expect(regRes.body.code).toBe(1000);
    const userBToken = regRes.body.data.token;
    expect(userBToken).toBeTruthy();

    // 用户 B 尝试访问 demo 用户拥有的 record id=1
    const res = await request
      .get('/app/record/1')
      .set('Authorization', userBToken);

    // CoolCommException('无权访问该记录', 403)：cool-admin 映射为 code:1001 业务错误
    // （部分版本保留 HTTP 403，此处做兼容断言）
    expect(res.body.code).not.toBe(1000);
    const denied =
      res.status === 403 ||
      (typeof res.body.message === 'string' && res.body.message.includes('无权'));
    expect(denied).toBe(true);
  });

  it('IDOR 防护回归：demo 用户访问自己的 record id=1 仍成功', async () => {
    const res = await request
      .get('/app/record/1')
      .set('Authorization', token);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(1000);
    expect(res.body.data.id).toBe(1);
    expect(res.body.data.userId).toBe(1);
  });
});
